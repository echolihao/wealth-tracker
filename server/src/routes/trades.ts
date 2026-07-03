import {
  getSecuritiesAccounts,
  getPositions,
  getPositionTrades,
  updatePositionPrice,
  getTrades,
  createTrade,
  updateTrade,
  deleteTrade,
  exportTradesCsv,
  importTrades,
} from '../controllers/trades'

export default [
  {
    method: 'GET',
    url: '/api/trades/securities-accounts',
    handler: getSecuritiesAccounts,
  },
  {
    method: 'GET',
    url: '/api/assets/:id/positions',
    handler: getPositions,
  },
  {
    method: 'GET',
    url: '/api/positions/:id/trades',
    handler: getPositionTrades,
  },
  {
    method: 'PUT',
    url: '/api/assets/:id/positions/:symbol',
    handler: updatePositionPrice,
  },
  {
    method: 'GET',
    url: '/api/assets/:id/trades',
    handler: getTrades,
  },
  {
    method: 'POST',
    url: '/api/assets/:id/trades',
    handler: createTrade,
  },
  {
    method: 'PUT',
    url: '/api/trades/:id',
    handler: updateTrade,
  },
  {
    method: 'DELETE',
    url: '/api/trades/:id',
    handler: deleteTrade,
  },
  {
    method: 'GET',
    url: '/api/assets/:id/trades/export',
    handler: exportTradesCsv,
  },
  {
    method: 'POST',
    url: '/api/assets/:id/trades/import',
    handler: importTrades,
  },
]
