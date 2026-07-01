<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { Pagination, Table } from 'flowbite-svelte'
  import SvgIcon from './SvgIcon.svelte'
  import Skeleton from './Skeleton.svelte'
  import BatchImport from './BatchImport.svelte'
  import { deleteTrade } from '../helper/apis'
  import { alert, notice } from '../stores'
  import type { LinkType } from 'flowbite-svelte'

  const dispatch = createEventDispatcher()

  export let trades: any[] = []
  export let total = 0
  export let page = 1
  export let size = 10
  export let loading = false
  export let assetType = ''
  export let showImportButton = false

  let localStartDate = ''
  let localEndDate = ''
  let localType = ''
  let localSymbol = ''

  let showDeleteConfirm = false
  let deleteTarget: any = null
  let showBatchImport = false

  $: totalPages = Math.ceil(total / size)

  const formatAmount = (value: any) => {
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
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
      <label for="search-start-date" class="mb-0.5 block text-xs text-gray-500">{$_('startDate')}</label>
      <input
        id="search-start-date"
        type="date"
        bind:value={localStartDate}
        class="rounded border border-gray-300 px-2 py-1.5 text-sm" />
    </div>
    <div class="pb-1 text-sm text-gray-400">~</div>
    <div>
      <label for="search-end-date" class="mb-0.5 block text-xs text-gray-500">{$_('endDate')}</label>
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
      <label for="search-symbol" class="mb-0.5 block text-xs text-gray-500">{$_('securitySymbol')}</label>
      <input
        id="search-symbol"
        type="text"
        bind:value={localSymbol}
        placeholder="{$_('securitySymbol')}"
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
              {formatAmount(trade.amount)}
            </td>
            <td class="max-w-[200px] truncate px-4 text-center text-sm text-gray-500" title={trade.note}>
              {trade.note || '-'}
            </td>
            <td class="text-center">
              <button
                on:click={() => handleDelete(trade)}
                class="text-sm text-gray-400 hover:text-red-500"
                title={$_('destroy')}>
                <SvgIcon name="close" width={16} height={16} />
              </button>
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
    <div
      class="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
      on:click|stopPropagation>
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

<BatchImport
  {assetType}
  show={showBatchImport}
  on:imported={() => {
    showBatchImport = false
    dispatch('imported')
  }} />
