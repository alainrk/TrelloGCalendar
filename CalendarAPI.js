const fs = require('fs')
const debug = require('debug')('TCINT:CalendarApi')
const readline = require('readline-sync')
const {google} = require('googleapis')

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar']
const TOKEN_PATH = 'token.json'

// DOC: https://developers.google.com/calendar/v3/reference/

class CalendarApi {

  // Singleton
  constructor (secretsPath) {
    if (!CalendarApi.instance) {
      debug('Instanciating Calendar API')
      CalendarApi.instance = this
      this.secretsPath = secretsPath
      this.calendarClient = null
    } else {
      debug('Already existing instance of Calendar API')
      if (this.secretsPath && this.secretsPath !== secretsPath) {
        throw new Error('Calendar API is a singleton and secretsPath given is different from the previous one')
      }
    }
    return CalendarApi.instance
  }

  async init () {
    this.calendarClient = await this.__getCalendarClient()
  }

  async __getCalendarClient () {
    // Load client secrets from local file.
    let secretFile = fs.readFileSync(this.secretsPath)
    let secrets = JSON.parse(secretFile)
    // Authorize a client with credentials, then call the Google Calendar API.
    let oAuth2Client = await this.__authorize(secrets.google.calendar)
    return oAuth2Client
  }

  /**
   * Create an OAuth2 client with the given credentials
   * @param {Object} credentials The authorization client credentials.
   */
  async __authorize (credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.installed
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0])

    // Check if we have previously stored a token, ask again otherwise
    let token = null
    try {
      token = fs.readFileSync(TOKEN_PATH)
      token = JSON.parse(token)
    } catch (err) {
      token = await this.__getAccessToken(oAuth2Client)
    }
    oAuth2Client.setCredentials(token)
    return oAuth2Client
  }

  /**
   * Get and store new token after prompting for user authorization
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   */
  async __getAccessToken (oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    })
    debug('Authorize this app by visiting this url:', authUrl)
    let code = await readline.question('Enter the code from that page here: ')
    let res = await oAuth2Client.getToken(code)
    await fs.writeFileSync(TOKEN_PATH, JSON.stringify(res.tokens))
    return res.tokens
  }

  /**
   * Lists of events on the user's primary calendar in range date.
   * @param {String} dayMin In valid format for Date
   * @param {String} dayMax In valid format for Date
   */
  async getEventsPerDay (dayMin, dayMax) {
    let auth = this.calendarClient
    const calendar = google.calendar({version: 'v3', auth})

    let params = {
      calendarId: 'primary',
      timeMin: (new Date(dayMin)).toISOString(),
      timeMax: (new Date(dayMax)).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    }

    try {
      const res = await calendar.events.list(params)
      return res.data.items
    } catch (error) {
      console.error('Error in google api:')
      return null
    }
  }

  async createEvent ({summary, location = '', description, day}) {
    let auth = this.calendarClient
    const calendar = google.calendar({version: 'v3', auth})

    let event = {
      calendarId: 'primary',
      resource: {
        summary: summary,
        location: location,
        description: description,
        start: {
          date: day,
          timeZone: 'Europe/Rome',
        },
        end: {
          date: day,
          timeZone: 'Europe/Rome',
        },
        reminders: {
          'useDefault': true
        }
      }
    }

    try {
      const res = await calendar.events.insert(event)
      return res.data.items
    } catch (error) {
      console.error('Error in google api:', error)
      return null
    }
  }

  async patchEvent (eventId, {summary, location = '', description, day}) {
    let auth = this.calendarClient
    const calendar = google.calendar({version: 'v3', auth})

    let event = {
      calendarId: 'primary',
      eventId: eventId,
      resource: {
        summary: summary,
        location: location,
        description: description,
        start: {
          date: day,
          timeZone: 'Europe/Rome',
        },
        end: {
          date: day,
          timeZone: 'Europe/Rome',
        }
      }
    }

    try {
      const res = await calendar.events.patch(event)
      return res.data.items
    } catch (error) {
      console.error('Error in google api:', error)
      return null
    }
  }
}

module.exports = CalendarApi
