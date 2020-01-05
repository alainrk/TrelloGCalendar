const debug = require('debug')('TCINT')
const moment = require('moment')
const config = require('./config.json')

const CalendarApi = require('./CalendarAPI')
const TrelloApi = require('./TrelloAPI')

const TRELLO_ID_REGEX = /\[TRELLO\](.*)\[\/TRELLO\]/
const TRELLO_EDIT_REGEX = /\[LASTEDIT\](.*)\[\/LASTEDIT\]/
const SECRETS_PATH = 'secrets.json'

async function getCards (trelloApi) {
  let cards = await trelloApi.getCards(config.ID_BOARD, true)
  cards = cards
    .filter(card => card.due)
    .map((card) => {
      let item = {
        id: card.id,
        // Only get moment day in YYYY-MM-DD HH:mm
        dateLastActivity: moment(moment(card.dateLastActivity).format('YYYY-MM-DD HH:mm'), 'YYYY-MM-DD HH:mm'),
        closed: card.closed,
        name: card.name,
        due: moment(card.due),
        dueComplete: card.dueComplete,
        description: card.desc,
        url: card.shortUrl
      }
      return item
    })
  return cards
}

async function test () {
  let calendarAPI = new CalendarApi(SECRETS_PATH)
  let trelloApi = new TrelloApi(SECRETS_PATH)
  await calendarAPI.init()
  await trelloApi.init()

  let cards = await getCards(trelloApi)
  debug('Checking matching events/cards for same day\n\n')
  for (let card of cards) {

    if (card.dueComplete) {
      continue
    }

    debug('Card', card.name, 'ID', card.id, 'on Date:', card.due.format('YYYY-MM-DD'))
    debug('----')
    let dateMin = `${card.due.format('YYYY-MM-DD')} 00:00`
    let dateMax = `${card.due.format('YYYY-MM-DD')} 23:59`
    let existingEvents = await calendarAPI.getEventsPerDay(dateMin, dateMax)
    let action = { value: 'pass' }

    // If no matching event, create an event
    if (existingEvents.length <= 0) {
      action = { value: 'new' }
    } else {
      let found = true
      debug('Already matching events for this day')
      for (let event of existingEvents) {
        let match = null
        let id = null
        let lastedit = null

        debug('Existing Event:', event.summary)
        // Event is matching if card id matches TRELLO tag in description of event
        if ((match = TRELLO_ID_REGEX.exec(event.description)) !== null) {
          id = match[1]
          debug('Existing Card ID', id)
        }
        // Event is matching if card lastedit is after from event tagged one (is changed)
        if ((match = TRELLO_EDIT_REGEX.exec(event.description)) !== null) {
          lastedit = moment(match[1], 'YYYY-MM-DD HH:mm')
          debug('Existing Event lastedit', lastedit)
          debug('Current Card lastedit', card.dateLastActivity)
        }

        // If all is matching return true to get this event and update it with new information
        if (id && lastedit && id === card.id && lastedit.isBefore(card.dateLastActivity)) {
          debug('Need to update event', event.summary, id, lastedit, card.dateLastActivity)
          action = { value: 'update', event: event }
          break
        }
        // Same event but not update
        if (id && id === card.id) {
          action = { value: 'pass' }
          break
        }
        // Different event, set new for now, but continue loop to check if there is a correspondent event to current card
        // If no other correspondent event is found, new remains set and create new event correctly
        action = { value: 'new' }
        continue
      }
    }

    // Update, Create or Pass
    if (action.value === 'update') {
      debug('Update event for card', card.name)
      // Update matching event with new information
      await calendarAPI.patchEvent(action.event.id, {
        summary: card.name,
        location: '',
        description: `[TRELLO]${card.id}[/TRELLO]\n[LASTEDIT]${card.dateLastActivity.format('YYYY-MM-DD HH:mm')}[/LASTEDIT]\nDescription: ${card.description}\nLink: ${card.url}`,
        day: card.due.format('YYYY-MM-DD')
      })
    } else if (action.value === 'new') {
      debug('Insert event for card', card.name)
      await calendarAPI.createEvent({
        summary: card.name,
        location: '',
        description: `[TRELLO]${card.id}[/TRELLO]\n[LASTEDIT]${card.dateLastActivity.format('YYYY-MM-DD HH:mm')}[/LASTEDIT]\nDescription: ${card.description}\nLink: ${card.url}`,
        day: card.due.format('YYYY-MM-DD')
      })
    }

    debug('-------------------------\n')
  } // END For on cards
}


test().then(res => {
  debug('OK')
}).catch(err => {
  debug(err)
})