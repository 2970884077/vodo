import { request } from "https";

export function main () {
  
  const sslTunnelPool = {}
  IPC.answer('get-ssl-tunnel-port', (domain) => {
    if (!sslTunnelPool[domain]) {
      sslTunnelPool[domain] = IPC.request('ssl-tunnel-port', domain)
    }
    return sslTunnelPool[domain]
  })
  
  const recordedRequests = {}
  const recordedRequestsList = []
  let recordedBodySize = 0
  let truncatedRecordNum = 0
  
  IPC.answer('record-request', (requestID, data) => {
    try {
      if (!recordedRequests[requestID]) {
        recordedRequestsList.push(requestID)
        recordedRequests[requestID] = data
      } else {
        const record = recordedRequests[requestID]
        if (record.isTrucated) {
          delete data.requestBody
          delete data.responseBody
        }
        Object.assign(record, data)
      }
      if (data.requestBody) {
        recordedBodySize += data.requestBody.length
      }
      if (data.responseBody) {
        recordedBodySize += data.responseBody.length
      }
      const limit = Store.config.allRequestLimit * 1024 * 1024
      while (recordedBodySize > limit && truncatedRecordNum < recordedRequestsList.length) {
        const record = recordedRequests[recordedRequestsList[truncatedRecordNum]]
        record.isTruncated = true
        if (record.requestBody) {
          recordedBodySize -= record.requestBody.length
        }
        if (record.responseBody) {
          recordedBodySize -= record.responseBody.length
        }
        record.headers = {}
        record.responseHeaders = {}
        truncatedRecordNum++
      }
    } catch (err) {
      console.error(err.stack)
    }
  })
  
  IPC.answer('get-record', (requestID) => {
    const record = recordedRequests[requestID]
    if (record) {
      const ret = { ...record }
      delete ret.requestBody
      delete ret.responseBody
      return ret
    } else {
      throw new Error('No record')
    }
  })
  
  IPC.answer('get-record-field', (requestID, field) => {
    const record = recordedRequests[requestID]
    if (record && record.hasOwnProperty(field)) {
      return {
        result: record[field],
        examined: record[`${field}:examined`]
      }
    } else {
      throw new Error('No record')
    }
  })  
}
