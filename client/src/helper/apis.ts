import $ajax from './ajax'

const genApiPath = (path) => {
  return `/api/${path}`
}

export const createAssets = (data) => {
  return $ajax.post(genApiPath('assets'), data)
}

export const getAssets = (data = {}) => {
  return $ajax.get(genApiPath('assets'), data)
}

export const updateAssets = (data) => {
  return $ajax.put(genApiPath('assets'), data)
}

export const destroyAssets = (data) => {
  return $ajax.delete(genApiPath('assets'), data)
}

export const checkPassword = (data = {}) => {
  return $ajax.get(genApiPath('password/check'), data)
}

export const verifyPassword = (password: string) => {
  return $ajax.post(genApiPath('password/verify'), { password })
}

export const setPassword = (password: string) => {
  return $ajax.post(genApiPath('password/set'), { password })
}

export const getRecords = (data = {}) => {
  return $ajax.get(genApiPath('records'), data)
}

export const updateRecords = (data) => {
  return $ajax.post(genApiPath('records'), data)
}

export const destroyRecords = (data) => {
  return $ajax.delete(genApiPath('records'), data)
}

export const createInsights = (data) => {
  return $ajax.post(genApiPath('insights'), data)
}

export const getInsights = (data = {}) => {
  return $ajax.get(genApiPath('insights'), data)
}

export const updateInsights = (data) => {
  return $ajax.put(genApiPath('insights'), data)
}

export const destroyInsights = (data) => {
  return $ajax.delete(genApiPath('insights'), data)
}

export const getInsightsCalendarData = (data) => {
  return $ajax.get(genApiPath('insights/calendar'), data)
}

export const createGoal = (data) => {
  return $ajax.post(genApiPath('goals'), data)
}

export const getGoals = () => {
  return $ajax.get(genApiPath('goals'), {})
}

export const updateGoal = (data) => {
  return $ajax.put(genApiPath('goals'), data)
}

export const destroyGoal = (data) => {
  return $ajax.delete(genApiPath('goals'), data)
}

export const exportBackup = () => {
  return $ajax.get(genApiPath('backup/export'), {})
}

export const importBackup = (data) => {
  return $ajax.post(genApiPath('backup/import'), data)
}

export const resetDatabase = () => {
  return $ajax.post(genApiPath('reset'), {})
}

export const generateAdvice = (data) => {
  return $ajax.post(genApiPath('generate-advice'), data)
}

export const getUserSettings = () => {
  return $ajax.get(genApiPath('settings'), {})
}

export const updateUserSettings = (data) => {
  return $ajax.put(genApiPath('settings'), data)
}

export const getCustomCurrencies = () => {
  return $ajax.get(genApiPath('currencies'), {})
}

export const getAllCustomCurrencies = () => {
  return $ajax.get(genApiPath('currencies/all'), {})
}

export const createCustomCurrency = (data) => {
  return $ajax.post(genApiPath('currencies'), data)
}

export const updateCustomCurrency = (id, data) => {
  return $ajax.put(genApiPath(`currencies/${id}`), data)
}

export const deleteCustomCurrency = (id) => {
  return $ajax.delete(genApiPath(`currencies/${id}`), {})
}

export const getSecuritiesAccounts = () => {
  return $ajax.get(genApiPath('trades/securities-accounts'), {})
}

export const getPositions = (assetType: string) => {
  return $ajax.get(genApiPath(`assets/${assetType}/positions`), {})
}

export const updatePositionPrice = (
  assetType: string,
  symbol: string,
  data: { current_price?: number; amount?: number },
) => {
  return $ajax.put(genApiPath(`assets/${assetType}/positions/${symbol}`), data)
}

export const getTrades = (assetType: string, data = {}) => {
  return $ajax.get(genApiPath(`assets/${assetType}/trades`), data)
}

export const createTrade = (assetType: string, data: any) => {
  return $ajax.post(genApiPath(`assets/${assetType}/trades`), data)
}

export const updateTrade = (id: number, data: any) => {
  return $ajax.put(genApiPath(`trades/${id}`), data)
}

export const deleteTrade = (id: number) => {
  return $ajax.delete(genApiPath(`trades/${id}`), {})
}

export const importTrades = (assetType: string, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return $ajax.post(genApiPath(`assets/${assetType}/trades/import`), formData)
}
