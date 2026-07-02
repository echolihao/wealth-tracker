<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { Pagination, Table } from 'flowbite-svelte'
  import SvgIcon from './SvgIcon.svelte'
  import Skeleton from './Skeleton.svelte'
  import BatchImport from './BatchImport.svelte'
  import { deleteTrade, exportTradesCsv } from '../helper/apis'
  import { alert, notice } from '../stores'
  import type { LinkType } from 'flowbite-svelte'

  const dispatch = createEventDispatcher()

  export let trades: any[] = []
  export let total = 0
  export let page = 1
  export let size = 10
  export let loading = false
  export let assetType = ''
  export let assetId: number | string = ''
  export let showImportButton = false

  let localStartDate = ''
  let localEndDate = ''
  let localType = ''
  let localSymbol = ''

  let showDeleteConfirm = false
  let deleteTarget: any = null
  let showDetail = false
  let detailTarget: any = null
  let showBatchImport = false

  $: totalPages = Math.ceil(total / size)

  const formatAmount = (value: any) => {
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
  }

  const formatIntAmount = (value: any) => {
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }

  const formatBeijingTime = (value: any) => {
    if (!value) return '—'
    return new Date(value).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const handleDelete = (trade: any) => {
    deleteTarget = trade
    showDeleteConfirm = true
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteTrade(deleteTarget.id)
      notice.set($_('tradeDeleted'))
      showDeleteConfirm = false
      deleteTarget = null
      dispatch('deleted')
    } catch (error: any) {
      alert.set(error?.response?.data?.message || error.message)
    }
  }

  export let pageSizes = [10, 20, 50, 100]

  const handlePrevious = () => {
    if (page > 1) {
      dispatch('pageChange', page - 1)
    }
  }

  const handleNext = () => {
    if (page < totalPages) {
      dispatch('pageChange', page + 1)
    }
  }

  const handlePageClick = (event: Event) => {
    const target = event.target as HTMLElement
    const pageNum = Number(target.textContent?.trim())
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      dispatch('pageChange', pageNum)
    }
  }

  const handleSizeChange = (event: Event) => {
    const target = event.target as HTMLSelectElement
    dispatch('pageSizeChange', Number(target.value))
  }

  const handleExport = async () => {
    if (!assetId) return
    try {
      const params: any = {}
      if (localStartDate) params.startDate = localStartDate
      if (localEndDate) params.endDate = localEndDate
      if (localType) params.type = localType
      if (localSymbol) params.symbol = localSymbol
      await exportTradesCsv(assetId, params)
      notice.set($_('tradeExportSuccess'))
    } catch (error: any) {
      alert.set(error?.message || $_('tradeExportFailed'))
    }
  }

  const handleSearch = () => {
    dispatch('searchChange', {
      startDate: localStartDate,
      endDate: localEndDate,
      type: localType,
      symbol: localSymbol,
    })
  }

  const handleResetSearch = () => {
    localStartDate = ''
    localEndDate = ''
    localType = ''
    localSymbol = ''
    dispatch('searchChange', {
      startDate: '',
      endDate: '',
      type: '',
      symbol: '',
    })
  }

  $: pages = buildPagination(totalPages, page)

  const buildPagination = (total: number, current: number, maxVisible = 7): LinkType[] => {
    if (total <= 1) return []
    const items: LinkType[] = []

    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        items.push({ name: `${i}`, active: i === current, href: '' })
      }
    } else {
      items.push({ name: `${1}`, active: 1 === current, href: '' })
      let start = Math.max(2, current - 2)
      let end = Math.min(total - 1, current + 2)
      if (current <= 3) {
        end = Math.min(total - 1, maxVisible - 1)
      }
      if (current >= total - 2) {
        start = Math.max(2, total - maxVisible + 2)
      }
      if (start > 2) {
        items.push({ name: '...', active: false, href: '' })
      }
      for (let i = start; i <= end; i++) {
        items.push({ name: `${i}`, active: i === current, href: '' })
      }
      if (end < total - 1) {
        items.push({ name: '...', active: false, href: '' })
      }
      items.push({ name: `${total}`, active: total === current, href: '' })
    }
    return items
  }
</script>

<div class="w-full">
  <div class="mb-3 flex items-center justify-between">
    <h3 class="text-base font-medium">{$_('tradeHistory')}</h3>
    <div class="flex items-center gap-2">
      {#if showImportButton}
        <button
          on:click={handleExport}
          class="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
          {$_('exportTradeCsv')}
        </button>
        <button
          on:click={() => (showBatchImport = true)}
          class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          {$_('batchImport')}
        </button>
      {/if}
    </div>
  </div>

  <!-- Search bar -->
  <div class="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
    <div>
      <label for="search-start-date" class="mb-0.5 block text-xs text-gray-500">
        {$_('startDate')}
      </label>
      <input
        id="search-start-date"
        type="date"
        bind:value={localStartDate}
        class="rounded border border-gray-300 px-2 py-1.5 text-sm" />
    </div>
    <div class="pb-1 text-sm text-gray-400">~</div>
    <div>
      <label for="search-end-date" class="mb-0.5 block text-xs text-gray-500">
        {$_('endDate')}
      </label>
      <input
        id="search-end-date"
        type="date"
        bind:value={localEndDate}
        class="rounded border border-gray-300 px-2 py-1.5 text-sm" />
    </div>
    <div>
      <label for="search-type" class="mb-0.5 block text-xs text-gray-500">{$_('action')}</label>
      <select
        id="search-type"
        bind:value={localType}
        class="rounded border border-gray-300 px-2 py-1.5 text-sm">
        <option value="">{$_('all')}</option>
        <option value="BUY">{$_('buy')}</option>
        <option value="SELL">{$_('sell')}</option>
      </select>
    </div>
    <div>
      <label for="search-symbol" class="mb-0.5 block text-xs text-gray-500">
        {$_('securitySymbol')}
      </label>
      <input
        id="search-symbol"
        type="text"
        bind:value={localSymbol}
        placeholder={$_('securitySymbol')}
        class="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm" />
    </div>
    <div class="flex items-center gap-1">
      <button
        on:click={handleSearch}
        class="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
        {$_('search')}
      </button>
      <button
        on:click={handleResetSearch}
        class="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
        {$_('reset')}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="space-y-2">
      <Skeleton width="w-full" height="h-8" />
      <Skeleton width="w-full" height="h-8" />
    </div>
  {:else if trades.length === 0}
    <div class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500">
      {$_('noTrades')}
    </div>
  {:else}
    <Table>
      <thead>
        <tr>
          <th>{$_('tradeDate')}</th>
          <th>{$_('action')}</th>
          <th>{$_('securitySymbol')}</th>
          <th>{$_('securityName')}</th>
          <th class="text-right">{$_('quantity')}</th>
          <th class="text-right">{$_('price')}</th>
          <th class="text-right">{$_('tradeAmount')}</th>
          <th class="text-center">{$_('remark')}</th>
          <th class="text-center">{$_('action')}</th>
        </tr>
      </thead>
      <tbody>
        {#each trades as trade (trade.id)}
          <tr class="hover:bg-gray-50">
            <td class="text-sm">{trade.trade_date}</td>
            <td>
              <span
                class="inline-block rounded-full px-2 py-0.5 text-xs font-medium
                {trade.type === 'BUY'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-700'}">
                {trade.type === 'BUY' ? $_('buy') : $_('sell')}
              </span>
            </td>
            <td class="font-mono text-sm">{trade.security_symbol}</td>
            <td>{trade.security_name}</td>
            <td class="text-right font-mono text-sm">
              {Number(trade.quantity).toLocaleString()}
            </td>
            <td class="text-right font-mono text-sm">
              {formatAmount(trade.price)}
            </td>
            <td class="text-right font-mono text-sm">
              {formatIntAmount(trade.amount)}
            </td>
            <td
              class="max-w-[200px] truncate px-4 text-center text-sm text-gray-500"
              title={trade.note}>
              {trade.note || '-'}
            </td>
            <td class="text-center">
              <div class="flex items-center justify-center gap-1">
                <button
                  on:click={() => {
                    detailTarget = trade
                    showDetail = true
                  }}
                  class="text-sm text-gray-400 hover:text-brand"
                  title={$_('viewDetail')}>
                  <SvgIcon name="info" width={16} height={16} />
                </button>
                <button
                  on:click={() => handleDelete(trade)}
                  class="text-sm text-gray-400 hover:text-red-500"
                  title={$_('destroy')}>
                  <SvgIcon name="close" width={16} height={16} />
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </Table>

    {#if totalPages > 1}
      <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
        <span class="text-sm text-gray-500">
          共 {total} 条
        </span>
        <div class="flex items-center gap-4">
          <Pagination
            {pages}
            large
            on:previous={handlePrevious}
            on:next={handleNext}
            on:click={handlePageClick}
            activeClass="text-brand">
            <svelte:fragment slot="prev">
              <span class="sr-only">Previous</span>
              <SvgIcon name="chevron-left" />
            </svelte:fragment>
            <svelte:fragment slot="next">
              <span class="sr-only">Next</span>
              <SvgIcon name="chevron-right" />
            </svelte:fragment>
          </Pagination>
          <select
            class="rounded border border-gray-300 px-2 py-1 text-sm"
            on:change={handleSizeChange}
            value={size}>
            {#each pageSizes as s}
              <option value={s}>{s} 条/页</option>
            {/each}
          </select>
        </div>
      </div>
    {:else if total > 10}
      <div class="mt-4 flex justify-center">
        <select
          class="rounded border border-gray-300 px-2 py-1 text-sm"
          on:change={handleSizeChange}
          value={size}>
          {#each pageSizes as s}
            <option value={s}>{s} 条/页</option>
          {/each}
        </select>
      </div>
    {/if}
  {/if}
</div>

<!-- Delete confirmation modal -->
{#if showDeleteConfirm}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    on:click={() => (showDeleteConfirm = false)}>
    <div class="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" on:click|stopPropagation>
      <div class="mb-4 flex items-center gap-2">
        <SvgIcon name="close" width={20} height={20} color="#dc2626" />
        <span class="font-medium">{$_('destroy')} {$_('trade')}</span>
      </div>
      <p class="mb-6 text-sm text-gray-600">
        {$_('deleteTradeConfirm')}
      </p>
      <div class="flex justify-center gap-3">
        <button
          on:click={() => (showDeleteConfirm = false)}
          class="cancel-btn rounded px-4 py-2 text-sm">
          {$_('cancel')}
        </button>
        <button
          on:click={confirmDelete}
          class="rounded bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">
          {$_('confirm')}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Trade detail modal -->
{#if showDetail && detailTarget}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    on:click={() => (showDetail = false)}>
    <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl" on:click|stopPropagation>
      <div class="mb-4 flex items-center justify-between border-b pb-3">
        <h3 class="text-lg font-semibold">{$_('tradeDetail')}</h3>
        <button on:click={() => (showDetail = false)} class="text-gray-400 hover:text-gray-600">
          <SvgIcon name="close" width={20} height={20} />
        </button>
      </div>
      <div class="space-y-3">
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('tradeId')}</span>
          <span class="text-sm font-mono font-medium">{detailTarget.id}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('assetId')}</span>
          <span class="text-sm font-mono font-medium">{detailTarget.asset_id}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('tradeDate')}</span>
          <span class="text-sm font-medium">{detailTarget.trade_date}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('action')}</span>
          <span
            class="inline-block rounded-full px-2 py-0.5 text-xs font-medium
            {detailTarget.type === 'BUY'
              ? 'bg-green-100 text-green-700'
              : 'bg-orange-100 text-orange-700'}">
            {detailTarget.type === 'BUY' ? $_('buy') : $_('sell')}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('securitySymbol')}</span>
          <span class="text-sm font-mono font-medium">{detailTarget.security_symbol}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('securityName')}</span>
          <span class="text-sm font-medium">{detailTarget.security_name}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('quantity')}</span>
          <span class="text-sm font-medium">{Number(detailTarget.quantity).toLocaleString()}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('price')}</span>
          <span class="text-sm font-medium">{formatAmount(detailTarget.price)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('fee')}</span>
          <span class="text-sm font-medium">{formatAmount(detailTarget.fee)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('tradeAmount')}</span>
          <span class="text-sm font-medium">{formatIntAmount(detailTarget.amount)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('realizedPnl')}</span>
          {#if detailTarget.realized_pnl != null}
            <span
              class="text-sm font-bold
              {Number(detailTarget.realized_pnl) >= 0 ? 'text-red-500' : 'text-green-600'}">
              {Number(detailTarget.realized_pnl) >= 0 ? '+' : ''}{formatIntAmount(
                detailTarget.realized_pnl,
              )}
            </span>
          {:else}
            <span class="text-sm text-gray-400">—</span>
          {/if}
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('remark')}</span>
          <span class="text-sm max-w-[250px] text-left">{detailTarget.note || '—'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-500">{$_('created')}</span>
          <span class="text-sm font-medium">{formatBeijingTime(detailTarget.created)}</span>
        </div>
      </div>
      <div class="mt-4 flex justify-center">
        <button on:click={() => (showDetail = false)} class="cancel-btn rounded px-4 py-2 text-sm">
          {$_('close')}
        </button>
      </div>
    </div>
  </div>
{/if}

<BatchImport
  assetId={assetId || assetType}
  show={showBatchImport}
  on:imported={() => {
    showBatchImport = false
    dispatch('imported')
  }} />
