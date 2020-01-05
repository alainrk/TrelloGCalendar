const axios = require('axios')
const fs = require('fs')
const debug = require('debug')('TCINT:TrelloApi')

const BASE_URI = 'https://api.trello.com/1/'

class TrelloAPI {

  // Singleton
  constructor (secretsPath) {
    if (!TrelloAPI.instance) {
      debug('Instanciating new Trello API')
      TrelloAPI.instance = this
      this.secretsPath = secretsPath
      this.trelloApiCall = null
      this.authParams = null
    } else {
      debug('Already existing instance of Trello API')
      if (this.secretsPath && this.secretsPath !== secretsPath) {
        throw new Error('Trello API is a singleton and secretsPath given is different from the previous one')
      }
    }
      return TrelloAPI.instance
    }

    async init () {
      let secrets = this.__getTrelloClient()
      this.authParams = {
        key: secrets.key,
        token: secrets.token,
      }
      this.trelloApiCall = axios.create({
        baseURL: BASE_URI,
        params: this.authParams
      })
    }

    __getTrelloClient () {
      // Load client secrets from local file.
      let secretFile = fs.readFileSync(this.secretsPath)
      let secrets = JSON.parse(secretFile)
      // Authorize a client with credentials, then call the Google Calendar API.
      let client = secrets.trello
      return client
    }

    async getBoards () {
      let res = await this.trelloApiCall.get('/boards', {
        baseURL: 'https://api.trello.com/1/members/me/'
      })
      return res.data || null
    }

    async getBoardById (id) {
      let res = await this.trelloApiCall.get(`/boards/${id}`)
      return res.data || null
    }

    async getCards (boardId, open = true) {
      let url = `/boards/${boardId}/cards${open ? '/open' : ''}`
      let res = await this.trelloApiCall.get(url)
      return res.data || null
    }
}

module.exports = TrelloAPI
