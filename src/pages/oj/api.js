import Vue from 'vue'
import store from '@/store'
import axios from 'axios'

Vue.prototype.$http = axios
axios.defaults.baseURL = '/api'
axios.defaults.xsrfHeaderName = 'X-CSRFToken'
axios.defaults.xsrfCookieName = 'csrftoken'

export default {
  getWebsiteConf (params) {
    return ajax('website', 'get', {
      params
    })
  },
  getAnnouncementList (offset, limit) {
    const params = {
      offset,
      limit
    }
    return ajax('announcement', 'get', {
      params
    })
  },
  login (data) {
    return ajax('login', 'post', {
      data
    })
  },
  checkUsernameOrEmail (username, email) {
    return ajax('check_username_or_email', 'post', {
      data: {
        username,
        email
      }
    })
  },
  register (data) {
    return ajax('register', 'post', {
      data
    })
  },
  logout () {
    return ajax('logout', 'get')
  },
  getCaptcha () {
    return ajax('captcha', 'get')
  },
  getUserInfo (username = undefined) {
    return ajax('profile', 'get', {
      params: {
        username
      }
    })
  },
  updateProfile (profile) {
    return ajax('profile', 'put', {
      data: profile
    })
  },
  freshDisplayID (userID) {
    return ajax('profile/fresh_display_id', 'get', {
      params: {
        user_id: userID
      }
    })
  },
  twoFactorAuth (method, data) {
    return ajax('two_factor_auth', method, {
      data
    })
  },
  tfaRequiredCheck (username) {
    return ajax('tfa_required', 'post', {
      data: {
        username
      }
    })
  },
  getSessions () {
    return ajax('sessions', 'get')
  },
  deleteSession (sessionKey) {
    return ajax('sessions', 'delete', {
      params: {
        session_key: sessionKey
      }
    })
  },
  applyResetPassword (data) {
    return ajax('apply_reset_password', 'post', {
      data
    })
  },
  resetPassword (data) {
    return ajax('reset_password', 'post', {
      data
    })
  },
  changePassword (data) {
    return ajax('change_password', 'post', {
      data
    })
  },
  changeEmail (data) {
    return ajax('change_email', 'post', {
      data
    })
  },
  getLanguages () {
    return ajax('languages', 'get')
  },
  getProblemTagList () {
    return ajax('problem/tags', 'get')
  },
  getProblemList (offset, limit, searchParams) {
    const params = {
      paging: true,
      offset,
      limit
    }
    Object.keys(searchParams).forEach((element) => {
      if (searchParams[element]) {
        params[element] = searchParams[element]
      }
    })
    return ajax('problem', 'get', {
      params
    })
  },
  pickone () {
    return ajax('pickone', 'get')
  },
  getProblem (problemID) {
    return ajax('problem', 'get', {
      params: {
        problem_id: problemID
      }
    })
  },
  getContestList (offset, limit, searchParams) {
    const params = {
      offset,
      limit
    }
    if (searchParams !== undefined) {
      Object.keys(searchParams).forEach((element) => {
        if (searchParams[element]) {
          params[element] = searchParams[element]
        }
      })
    }
    return ajax('contests', 'get', {
      params
    })
  },
  getContest (id) {
    return ajax('contest', 'get', {
      params: {
        id
      }
    })
  },
  getContestAccess (contestID) {
    return ajax('contest/access', 'get', {
      params: {
        contest_id: contestID
      }
    })
  },
  checkContestPassword (contestID, password) {
    return ajax('contest/password', 'post', {
      data: {
        contest_id: contestID,
        password
      }
    })
  },
  getContestAnnouncementList (contestId) {
    return ajax('contest/announcement', 'get', {
      params: {
        contest_id: contestId
      }
    })
  },
  getContestProblemList (contestId) {
    return ajax('contest/problem', 'get', {
      params: {
        contest_id: contestId
      }
    })
  },
  getContestProblem (problemID, contestID) {
    return ajax('contest/problem', 'get', {
      params: {
        contest_id: contestID,
        problem_id: problemID
      }
    })
  },
  submitCode (data) {
    return ajax('submission', 'post', {
      data
    })
  },
  getSubmissionList (offset, limit, params) {
    params.limit = limit
    params.offset = offset
    return ajax('submissions', 'get', {
      params
    })
  },
  getContestSubmissionList (offset, limit, params) {
    params.limit = limit
    params.offset = offset
    return ajax('contest_submissions', 'get', {
      params
    })
  },
  getSubmission (id) {
    return ajax('submission', 'get', {
      params: {
        id
      }
    })
  },
  submissionExists (problemID) {
    return ajax('submission_exists', 'get', {
      params: {
        problem_id: problemID
      }
    })
  },
  submissionRejudge (id) {
    return ajax('admin/submission/rejudge', 'get', {
      params: {
        id
      }
    })
  },
  updateSubmission (data) {
    return ajax('submission', 'put', {
      data
    })
  },
  getUserRank (offset, limit, rule = 'acm') {
    const params = {
      offset,
      limit,
      rule
    }
    return ajax('user_rank', 'get', {
      params
    })
  },
  getContestRank (params) {
    return ajax('contest_rank', 'get', {
      params
    })
  },
  getACMACInfo (params) {
    return ajax('admin/contest/acm_helper', 'get', {
      params
    })
  },
  updateACInfoCheckedStatus (data) {
    return ajax('admin/contest/acm_helper', 'put', {
      data
    })
  },
  reportAntiCheatViolation (data) {
    console.log('API: reportAntiCheatViolation called with data:', data)

    if (!data.contest_id) {
      console.error('API: Missing contest_id')
      return Promise.reject(new Error('Contest ID is required'))
    }

    if (!data.violation_type) {
      console.error('API: Missing violation_type')
      return Promise.reject(new Error('Violation type is required'))
    }

    // FIXED: Always include problem_id for problem-specific tracking
    const cleanData = {
      contest_id: String(data.contest_id),
      problem_id: data.problem_id ? String(data.problem_id) : undefined,
      violation_type: String(data.violation_type),
      violation_details: String(data.violation_details || ''),
      timestamp: data.timestamp || new Date().toISOString()
    }

    // Only remove undefined values, keep problem_id if provided
    Object.keys(cleanData).forEach((key) => {
      if (cleanData[key] === undefined) {
        delete cleanData[key]
      }
    })
    console.log('API: Sending cleaned data:', cleanData)

    return ajax('contest/anti_cheat_violation/', 'post', {
      data: cleanData
    })
      .then((response) => {
        console.log('API: reportAntiCheatViolation response:', response)
        return response
      })
      .catch((error) => {
        console.error('API: reportAntiCheatViolation error:', error)
        throw error
      })
  },
  getAntiCheatViolations (contestId, userId = null) {
    const params = {
      contest_id: contestId
    }
    if (userId) {
      params.user_id = userId
    }
    return ajax('contest/anti_cheat_violations', 'get', {
      params
    })
  },
  // Enhanced anti-cheat status check with better error handling
  checkProblemAntiCheatStatus (contestId, problemId) {
    console.log(`Checking anti-cheat status for contest ${contestId}, problem ${problemId}`)
    if (!contestId || !problemId) {
      console.warn('Missing contestId or problemId for anti-cheat status check')
      return Promise.reject(new Error('Contest ID and Problem ID are required'))
    }

    return ajax('contest/problem_anti_cheat_status', 'get', {
      params: {
        contest_id: String(contestId),
        problem_id: String(problemId)
      }
    })
      .then((response) => {
        console.log('Anti-cheat status response:', response)
        return response
      })
      .catch((error) => {
        console.warn('Anti-cheat status check failed:', error)
        // Handle specific error cases
        if (error.isApiError) {
          // This is an API error (from backend), check the message
          const errorMessage = error.message || 'Unknown API error'
          if (errorMessage.includes('Problem not found in this contest')) {
            console.error(`Problem ${problemId} does not belong to contest ${contestId}`)
            // You might want to redirect or show a specific error message
            throw new Error(`Problem not found in contest. Please check if problem ${problemId} belongs to contest ${contestId}.`)
          } else if (errorMessage.includes('Contest not found')) {
            console.error(`Contest ${contestId} not found`)
            throw new Error('Contest not found. Please check if the contest exists.')
          } else if (errorMessage.includes('Problem not found')) {
            console.error(`Problem ${problemId} not found`)
            throw new Error('Problem not found. Please check if the problem exists.')
          }
          // Re-throw other API errors
          throw error
        }
        // Only return default for network errors or unexpected errors
        console.warn('Returning default anti-cheat status due to network error')
        return {
          data: {
            error: null,
            data: {
              problem_violation_count: 0,
              problem_penalty_minutes: 0,
              problem_solved: false,
              anti_cheat_enabled: false
            }
          }
        }
      })
  },
  checkAntiCheatStatus (contestId) {
    console.log(`Checking general anti-cheat status for contest ${contestId}`)
    if (!contestId) {
      console.warn('Missing contestId for anti-cheat status check')
      return Promise.reject(new Error('Contest ID is required'))
    }

    return ajax('contest/anti_cheat_status', 'get', {
      params: {
        contest_id: String(contestId)
      }
    })
      .then((response) => {
        console.log('General anti-cheat status response:', response)
        return response
      })
      .catch((error) => {
        console.warn('General anti-cheat status check failed:', error)
        // Return default response instead of throwing
        return {
          data: {
            error: null,
            data: {
              violation_count: 0,
              anti_cheat_enabled: false
            }
          }
        }
      })
  }
}

function ajax (url, method, options) {
  let params = {}
  let data = {}
  if (options !== undefined) {
    params = options.params || {}
    data = options.data || {}
  }

  return new Promise((resolve, reject) => {
    const config = {
      url,
      method,
      params,
      data,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    if (method.toLowerCase() === 'post' || method.toLowerCase() === 'put') {
      const csrfElement = document.querySelector('[name=csrfmiddlewaretoken]')
      const csrfToken = (csrfElement && csrfElement.value) || getCookie('csrftoken')
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken
      }
    }

    console.log(`AJAX ${method.toUpperCase()} ${url}:`, config)

    axios(config).then(
      (res) => {
        console.log(`AJAX ${method.toUpperCase()} ${url} response:`, res)
        // Check if the response indicates an API error
        if (res.data && res.data.error !== null && res.data.error !== undefined && res.data.error !== '') {
          console.error(`AJAX ${method.toUpperCase()} ${url} API error:`, res.data)
          const errorMessage = res.data.data || res.data.error || 'Unknown error'
          // Only show user-facing error messages for non-anti-cheat endpoints
          if (!url.includes('anti_cheat')) {
            Vue.prototype.$error(errorMessage)
          }
          // Create a proper error object
          const apiError = new Error(errorMessage)
          apiError.response = res
          apiError.isApiError = true
          // Handle login redirect for authentication errors
          if (res.data.data && res.data.data.startsWith('Please login')) {
            store.dispatch('changeModalStatus', {
              mode: 'login',
              visible: true
            })
          }
          reject(apiError)
        } else {
          resolve(res)
        }
      },
      (res) => {
        console.error(`AJAX ${method.toUpperCase()} ${url} request error:`, res)

        let errorMessage = 'Network error'
        if (res.response) {
          if (res.response.status) {
            errorMessage = `HTTP ${res.response.status}: ${res.response.statusText || 'Error'}`
          }
          if (res.response.data) {
            if (typeof res.response.data === 'string') {
              errorMessage = res.response.data
            } else if (res.response.data.error) {
              errorMessage = res.response.data.error
            } else if (res.response.data.data) {
              errorMessage = res.response.data.data
            }
          }
        } else if (res.code === 'ECONNABORTED') {
          errorMessage = 'Request timeout'
        } else if (res.message) {
          errorMessage = res.message
        }

        // Only show user-facing error messages for non-anti-cheat endpoints
        if (!url.includes('anti_cheat')) {
          Vue.prototype.$error(errorMessage)
        }
        reject(res)
      }
    )
  })
}

function getCookie (name) {
  let cookieValue = null
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';')
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim()
      if (cookie.substring(0, name.length + 1) === name + '=') {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1))
        break
      }
    }
  }
  return cookieValue
}
