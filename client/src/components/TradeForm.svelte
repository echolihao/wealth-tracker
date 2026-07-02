<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import dayjs from 'dayjs'
  import SvgIcon from './SvgIcon.svelte'
  import { createTrade } from '../helper/apis'
  import { alert, notice } from '../stores'

  const dispatch = createEventDispatcher()

  export let assetId: number | string = ''

  let tradeType = 'BUY'
  let securitySymbol = ''
  let securityName = ''
  let quantity = ''
  let price = ''
  let amount = 0
  let fee = ''
  let tradeDate = dayjs().format('YYYY-MM-DD')
  let note = ''
  let submitting = false

  $: {
    const qty = parseFloat(quantity) || 0
    const p = parseFloat(price) || 0
    amount = qty * p
  }

  const resetForm = () => {
    securitySymbol = ''
    securityName = ''
    quantity = ''
    price = ''
    amount = 0
    fee = ''
    tradeDate = dayjs().format('YYYY-MM-DD')
    note = ''
  }

  const handleSubmit = async () => {
    if (!securitySymbol.trim()) {
      alert.set($_('securitySymbol') + ' ' + $_('fillAccountTypeTip'))
      return
    }
    if (!securityName.trim()) {
      alert.set($_('securityName') + ' ' + $_('fillAccountTypeTip'))
      return
    }
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) {
      alert.set($_('quantity') + ' ' + $_('fillAccountTypeTip'))
      return
    }
    const p = parseFloat(price)
    if (!p || p <= 0) {
      alert.set($_('price') + ' ' + $_('fillAccountTypeTip'))
      return
    }
    if (!tradeDate) {
      alert.set($_('tradeDate') + ' ' + $_('fillValidDateTip'))
      return
    }

    submitting = true
    try {
      const tradeFee = parseFloat(fee) || 0
      await createTrade(assetId, {
        type: tradeType,
        security_symbol: securitySymbol.trim(),
        security_name: securityName.trim(),
        quantity: qty,
        price: p,
        amount: amount,
        fee: tradeFee > 0 ? tradeFee : undefined,
        trade_date: tradeDate,
        note: note.trim(),
      })
      notice.set($_('tradeSuccess'))
      // Keep symbol/name for consecutive trades, clear rest
      quantity = ''
      price = ''
      amount = 0
      fee = ''
      dispatch('created')
    } catch (error: any) {
      const msg = error?.response?.data?.message || error.message
      alert.set(msg)
    } finally {
      submitting = false
    }
  }

  const selectSell = (data: { symbol: string; name: string }) => {
    tradeType = 'SELL'
    securitySymbol = data.symbol
    securityName = data.name
  }

  export { selectSell }
</script>

<div class="w-full rounded-lg border border-gray-200 p-4">
  <h3 class="mb-4 flex items-center gap-2 text-base font-medium">
    <SvgIcon name="adjustment" width={18} height={18} color="#1e293b" />
    {$_('recordTrade')}
  </h3>

  <!-- Trade type toggle -->
  <div class="mb-4 flex gap-2">
    <button
      on:click={() => (tradeType = 'BUY')}
      class="rounded-full px-4 py-1.5 text-sm font-medium transition-all
      {tradeType === 'BUY'
        ? 'bg-green-500 text-white'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
      {$_('buy')}
    </button>
    <button
      on:click={() => (tradeType = 'SELL')}
      class="rounded-full px-4 py-1.5 text-sm font-medium transition-all
      {tradeType === 'SELL'
        ? 'bg-orange-500 text-white'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
      {$_('sell')}
    </button>
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="module-warp">
      <label class="custom-label">
        {$_('securitySymbol')}
        <i class="text-mark">*</i>
      </label>
      <input type="text" class="custom-input" bind:value={securitySymbol} placeholder="0700.HK" />
    </div>
    <div class="module-warp">
      <label class="custom-label">
        {$_('securityName')}
        <i class="text-mark">*</i>
      </label>
      <input
        type="text"
        class="custom-input"
        bind:value={securityName}
        placeholder={$_('securityName')} />
    </div>
    <div class="module-warp">
      <label class="custom-label">
        {$_('quantity')}
        <i class="text-mark">*</i>
      </label>
      <input type="number" step="1" class="custom-input" bind:value={quantity} placeholder="100" />
    </div>
    <div class="module-warp">
      <label class="custom-label">
        {$_('price')}
        <i class="text-mark">*</i>
      </label>
      <input
        type="number"
        step="0.0001"
        class="custom-input"
        bind:value={price}
        placeholder="700.00" />
    </div>
    <div class="module-warp">
      <label class="custom-label">{$_('tradeAmount')}</label>
      <input
        type="number"
        step="0.01"
        class="custom-input"
        class:bg-yellow-50={Math.abs(amount - (parseFloat(quantity) || 0) * (parseFloat(price) || 0)) > 0.01}
        bind:value={amount}
        placeholder="0.00" />
    </div>
    <div class="module-warp">
      <label class="custom-label">{$_('fee')}</label>
      <input
        type="number"
        step="0.01"
        min="0"
        class="custom-input"
        bind:value={fee}
        placeholder="0.00" />
    </div>
    <div class="module-warp">
      <label class="custom-label">
        {$_('tradeDate')}
        <i class="text-mark">*</i>
      </label>
      <input type="date" class="custom-input" bind:value={tradeDate} />
    </div>
  </div>
  <div class="module-warp mt-2">
    <label class="custom-label">{$_('remark')}</label>
    <input
      type="text"
      class="custom-input"
      bind:value={note}
      placeholder={$_('placeholderOfRemark')} />
  </div>
  <div class="mt-4 flex justify-center">
    <button
      on:click={handleSubmit}
      disabled={submitting}
      class="comfirm-btn rounded px-8 py-2 font-medium text-white disabled:opacity-50">
      {submitting ? $_('persist') + '...' : $_('recordTrade')}
    </button>
  </div>
</div>
