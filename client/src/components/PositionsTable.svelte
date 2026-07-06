<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import { _ } from 'svelte-i18n'
  import { Table } from 'flowbite-svelte'
  import SvgIcon from './SvgIcon.svelte'
  import Skeleton from './Skeleton.svelte'
  import { updatePositionPrice, getPositionTrades } from '../helper/apis'
  import { notice } from '../stores'

  const dispatch = createEventDispatcher()

  export let positions: any[] = []
  export let loading = false
  export let assetId: number | string = ''

  let editingSymbol: string | null = null
  let editingPrice: string = ''
  let showClosed = false
  let showTradesModal = false
  let tradesLoading = false
  let positionTrades: any[] = []
  let positionForTrades: any = null

  $: totalOpenPnl = openPositions.reduce((sum, p) => {
    const unrealized =
      (Number(p.current_price ?? 0) - Number(p.cost_price ?? 0)) * Number(p.quantity ?? 0)
    return sum + unrealized + Number(p.realized_pnl ?? 0)
  }, 0)

  $: totalAllPnl =
    totalOpenPnl + closedPositions.reduce((sum, p) => sum + Number(p.realized_pnl ?? 0), 0)

  $: openPositions = positions.filter((p: any) => p.status === 'Open')
  $: closedPositions = positions
    .filter((p: any) => p.status === 'Closed')
    .sort((a: any, b: any) => {
      if (!a.close_date) return 1
      if (!b.close_date) return -1
      return b.close_date.localeCompare(a.close_date)
    })

  const formatPrice = (value: any) => {
    if (value === null || value === undefined) return '-'
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
  }

  const formatAmount = (value: any) => {
    if (value === null || value === undefined) return '-'
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }

  const formatQty = (value: any) => {
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }

  const formatPnl = (value: any) => {
    const v = Number(value ?? 0)
    return (
      (v > 0 ? '+' : '') +
      v.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )
  }

  const formatDate = (value: any) => {
    if (!value) return '-'
    return String(value)
  }

  const getHoldingDays = (position: any) => {
    const open = position.open_date
    if (!open) return '-'
    const start = new Date(open)
    const end = position.close_date ? new Date(position.close_date) : new Date()
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return days >= 0 ? days : '-'
  }

  const startEditPrice = (position: any) => {
    editingSymbol = position.security_symbol
    editingPrice = String(position.current_price ?? '')
  }

  const savePrice = async (position: any) => {
    const newPrice = parseFloat(editingPrice)
    if (isNaN(newPrice) || newPrice <= 0) {
      editingSymbol = null
      return
    }
    const newAmount = newPrice * Number(position.quantity)
    try {
      await updatePositionPrice(assetId, position.security_symbol, {
        current_price: newPrice,
        amount: newAmount,
      })
      notice.set($_('editPrice') + ' ✓')
      dispatch('priceUpdated')
    } catch (error) {
      console.error('Failed to update price:', error)
    }
    editingSymbol = null
  }

  const handleSell = (position: any) => {
    dispatch('sell', position)
  }

  const handleKeydown = (e: KeyboardEvent, position: any) => {
    if (e.key === 'Enter') {
      e.stopPropagation() // 阻止冒泡到 td 的 keydown handler，避免 startEditPrice 重置 editingPrice
      savePrice(position)
    }
    if (e.key === 'Escape') {
      editingSymbol = null
    }
  }

  const formatIntAmount = (value: any) => {
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }

  const handleViewTrades = async (position: any) => {
    positionForTrades = position
    showTradesModal = true
    tradesLoading = true
    positionTrades = []
    try {
      const result: any = await getPositionTrades(position.id)
      positionTrades = result.trades || []
    } catch (error) {
      console.error('Error fetching position trades:', error)
      notice.set('获取交易记录失败')
    } finally {
      tradesLoading = false
    }
  }
</script>

<div class="w-full">
  {#if loading}
    <div class="space-y-2">
      <Skeleton width="w-full" height="h-8" />
      <Skeleton width="w-full" height="h-8" />
      <Skeleton width="w-full" height="h-8" />
    </div>
  {:else if positions.length === 0}
    <div class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500">
      {$_('noPositions')}
    </div>
  {:else}
    <!-- Open positions -->
    <Table>
      <thead>
        <tr>
          <th>{$_('positionId')}</th>
          <th>{$_('securitySymbol')}</th>
          <th>{$_('securityName')}</th>
          <th class="text-right">{$_('quantity')}</th>
          <th class="text-right">{$_('costPrice')}/{$_('currentPrice')}</th>
          <th class="text-right">{$_('marketValue')}</th>
          <th class="text-right">{$_('profitLoss')}</th>
          <th class="text-center">{$_('openDate')}</th>
          <th class="text-center">{$_('holdingDays')}</th>
          <th class="text-center">{$_('action')}</th>
        </tr>
      </thead>
      <tbody>
        {#each openPositions as position (position.id)}
          <tr class="hover:bg-gray-50">
            <td class="text-xs text-gray-400 font-mono">{position.id}</td>
            <td class="font-mono text-sm">{position.security_symbol}</td>
            <td class="max-w-[120px] truncate" title={position.security_name}>
              {position.security_name}
            </td>
            <td class="text-right">{formatQty(position.quantity)}</td>
            <td class="text-right font-mono text-sm">
              <div>{formatPrice(position.cost_price)}</div>
              <div>
                {#if editingSymbol === position.security_symbol}
                  <input
                    type="number"
                    step="0.0001"
                    class="custom-input w-24 text-right text-sm"
                    bind:value={editingPrice}
                    on:blur={() => savePrice(position)}
                    on:keydown={(e) => handleKeydown(e, position)}
                    autofocus />
                {:else}
                  <span
                    class="cursor-pointer hover:text-brand"
                    role="button"
                    tabindex="0"
                    on:click={() => startEditPrice(position)}
                    on:keydown={(e) => e.key === 'Enter' && startEditPrice(position)}>
                    {formatPrice(position.current_price)}
                  </span>
                {/if}
              </div>
            </td>
            <td class="text-right font-mono text-sm">{formatAmount(position.amount)}</td>
            <td class="text-right font-mono text-sm">
              {#if position.current_price != null && position.cost_price != null && Number(position.cost_price) > 0}
                {@const unrealizedPnl =
                  (Number(position.current_price) - Number(position.cost_price)) *
                  Number(position.quantity)}
                {@const realizedPnl = Number(position.realized_pnl ?? 0)}
                {@const totalPnl = unrealizedPnl + realizedPnl}
                {@const costBasis = Number(position.cost_price) * Number(position.quantity)}
                {@const pnlPercent = costBasis > 0 ? (totalPnl / costBasis) * 100 : 0}
                <div
                  class:font-medium={true}
                  class:text-red-600={totalPnl > 0}
                  class:text-green-600={totalPnl < 0}>
                  <div>{totalPnl > 0 ? '+' : ''}{totalPnl.toLocaleString('zh-CN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</div>
                  <div class="text-xs">{pnlPercent > 0 ? '+' : ''}{pnlPercent.toFixed(2)}%</div>
                </div>
              {:else if position.current_price != null && position.cost_price != null}
                {@const unrealizedPnl =
                  (Number(position.current_price) - Number(position.cost_price)) *
                  Number(position.quantity)}
                {@const realizedPnl = Number(position.realized_pnl ?? 0)}
                {@const totalPnl = unrealizedPnl + realizedPnl}
                <span
                  class:font-medium={true}
                  class:text-red-600={totalPnl > 0}
                  class:text-green-600={totalPnl < 0}>
                  {totalPnl > 0 ? '+' : ''}{totalPnl.toLocaleString('zh-CN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              {:else}
                -
              {/if}
            </td>
            <td class="text-center text-sm">{formatDate(position.open_date)}</td>
            <td class="text-center text-sm">{getHoldingDays(position)}</td>
            <td class="text-center">
              <div class="flex items-center justify-center gap-1">
                <button
                  on:click={() => handleViewTrades(position)}
                  class="rounded px-2 py-1 text-xs font-medium text-gray-500
                    border border-gray-300 hover:bg-gray-100 transition-colors"
                  title="查看关联交易">
                  {$_('tradeHistory')}
                </button>
                <button
                  on:click={() => handleSell(position)}
                  class="rounded px-2 py-1 text-xs font-medium text-white
                    bg-orange-500 hover:bg-orange-600 transition-colors">
                  {$_('sell')}
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </Table>

    <!-- Closed positions toggle -->
    {#if closedPositions.length > 0}
      <button
        on:click={() => (showClosed = !showClosed)}
        class="mt-4 flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
        <SvgIcon name={showClosed ? 'chevron-down' : 'chevron-right'} width={16} height={16} />
        {$_('closedPositions')} ({closedPositions.length})
      </button>
      {#if showClosed}
        <Table>
          <thead>
            <tr>
              <th>{$_('positionId')}</th>
              <th>{$_('securitySymbol')}</th>
              <th>{$_('securityName')}</th>
              <th class="text-center">{$_('openDate')}</th>
              <th class="text-center">{$_('closeDate')}</th>
              <th class="text-center">{$_('holdingDays')}</th>
              <th class="text-right">{$_('profitLoss')}</th>
              <th class="text-center">{$_('action')}</th>
            </tr>
          </thead>
          <tbody>
            {#each closedPositions as position (position.id)}
              <tr class="text-gray-400">
                <td class="text-xs text-gray-400 font-mono">{position.id}</td>
                <td class="font-mono text-sm">{position.security_symbol}</td>
                <td class="max-w-[120px] truncate" title={position.security_name}>
                  {position.security_name}
                </td>
                <td class="text-center text-sm">{formatDate(position.open_date)}</td>
                <td class="text-center text-sm">{formatDate(position.close_date)}</td>
                <td class="text-center text-sm">{getHoldingDays(position)}</td>
                <td
                  class="text-right font-mono text-sm"
                  class:text-red-600={position.realized_pnl > 0}
                  class:text-green-600={position.realized_pnl < 0}>
                  {formatPnl(position.realized_pnl)}
                </td>
                <td class="text-center">
                  <button
                    on:click={() => handleViewTrades(position)}
                    class="rounded px-2 py-1 text-xs font-medium text-gray-500
                      border border-gray-300 hover:bg-gray-100 transition-colors"
                    title="查看关联交易">
                    {$_('tradeHistory')}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </Table>
      {/if}

      <!-- Summary: total P&L -->
      <div class="mt-4 flex items-center gap-8 border-t border-gray-200 pt-3 text-sm">
        <div class="flex items-center gap-2">
          <span class="text-gray-500">{$_('currentTotalPnl') || '当前持仓总盈亏'}:</span>
          <span
            class="font-mono font-medium"
            class:text-red-600={totalOpenPnl > 0}
            class:text-green-600={totalOpenPnl < 0}>
            {formatPnl(totalOpenPnl)}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-500">{$_('allTotalPnl') || '全部持仓总盈亏'}:</span>
          <span
            class="font-mono font-medium"
            class:text-red-600={totalAllPnl > 0}
            class:text-green-600={totalAllPnl < 0}>
            {formatPnl(totalAllPnl)}
          </span>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Position trades modal -->
{#if showTradesModal && positionForTrades}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    role="dialog"
    transition:fade={{ duration: 150 }}
    on:click={() => (showTradesModal = false)}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div
      class="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
      transition:scale={{ duration: 150, start: 0.95 }}
      on:click|stopPropagation>
      <div class="flex items-center justify-between border-b px-6 py-4">
        <h3 class="text-base font-semibold">
          交易记录 — {positionForTrades.security_name} ({positionForTrades.security_symbol})
          <span class="ml-2 text-sm font-normal text-gray-500">#{positionForTrades.id}</span>
        </h3>
        <button
          on:click={() => (showTradesModal = false)}
          class="text-gray-400 hover:text-gray-600">
          <SvgIcon name="close" width={20} height={20} />
        </button>
      </div>
      <div class="overflow-y-auto p-6">
        {#if tradesLoading}
          <div class="space-y-2">
            <Skeleton width="w-full" height="h-8" />
            <Skeleton width="w-full" height="h-8" />
          </div>
        {:else if positionTrades.length === 0}
          <div class="py-8 text-center text-gray-400">暂无关联交易记录</div>
        {:else}
          <Table>
            <thead>
              <tr>
                <th class="text-sm">{$_('tradeDate')}</th>
                <th class="text-sm">{$_('action')}</th>
                <th class="text-right text-sm">{$_('quantity')}</th>
                <th class="text-right text-sm">{$_('price')}</th>
                <th class="text-right text-sm">{$_('tradeAmount')}</th>
                <th class="text-right text-sm">{$_('realizedPnl')}</th>
              </tr>
            </thead>
            <tbody>
              {#each positionTrades as trade (trade.id)}
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
                  <td class="text-right font-mono text-sm">
                    {Number(trade.quantity).toLocaleString()}
                  </td>
                  <td class="text-right font-mono text-sm">
                    {Number(trade.price).toLocaleString('zh-CN', {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })}
                  </td>
                  <td class="text-right font-mono text-sm">
                    {formatIntAmount(trade.amount)}
                  </td>
                  <td class="text-right font-mono text-sm">
                    {#if trade.realized_pnl != null}
                      <span
                        class:text-red-600={Number(trade.realized_pnl) >= 0}
                        class:text-green-600={Number(trade.realized_pnl) < 0}>
                        {Number(trade.realized_pnl) >= 0 ? '+' : ''}{formatIntAmount(
                          trade.realized_pnl,
                        )}
                      </span>
                    {:else}
                      —
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </Table>
        {/if}
      </div>
    </div>
  </div>
{/if}
