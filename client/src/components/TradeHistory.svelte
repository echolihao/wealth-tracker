<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { Pagination, Table } from 'flowbite-svelte'
  import SvgIcon from './SvgIcon.svelte'
  import Skeleton from './Skeleton.svelte'
  import { deleteTrade } from '../helper/apis'
  import { alert, notice } from '../stores'
  import type { LinkType } from 'flowbite-svelte'

  const dispatch = createEventDispatcher()

  export let trades: any[] = []
  export let total = 0
  export let page = 1
  export let size = 10
  export let loading = false

  let showDeleteConfirm = false
  let deleteTarget: any = null

  const totalPages = Math.ceil(total / size)

  const formatAmount = (value: any) => {
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

  $: pages = assemblePagination(totalPages, page)

  const assemblePagination = (total: number, current: number): LinkType[] => {
    if (total <= 1) return []
    const items: LinkType[] = []
    for (let i = 1; i <= total; i++) {
      items.push({
        name: `${i}`,
        active: i === current,
        href: '',
      })
    }
    return items
  }
</script>

<div class="w-full">
  <h3 class="mb-3 text-base font-medium">{$_('recordDetails')}</h3>

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
      <div class="mt-4 flex justify-center">
        <Pagination
          {pages}
          large
          on:previous={handlePrevious}
          on:next={handleNext}
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
