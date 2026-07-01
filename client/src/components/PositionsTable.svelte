<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { Table } from 'flowbite-svelte'
  import SvgIcon from './SvgIcon.svelte'
  import Skeleton from './Skeleton.svelte'
  import { updatePositionPrice } from '../helper/apis'
  import { notice } from '../stores'

  const dispatch = createEventDispatcher()

  export let positions: any[] = []
  export let loading = false
  export let assetType = ''

  let editingSymbol: string | null = null
  let editingPrice: string = ''
  let showClosed = false

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
      await updatePositionPrice(assetType, position.security_symbol, {
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
      savePrice(position)
    }
    if (e.key === 'Escape') {
      editingSymbol = null
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
          <th>{$_('securitySymbol')}</th>
          <th>{$_('securityName')}</th>
          <th class="text-right">{$_('quantity')}</th>
          <th class="text-right">{$_('costPrice')}</th>
          <th class="text-right">{$_('currentPrice')}</th>
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
            <td class="font-mono text-sm">{position.security_symbol}</td>
            <td>{position.security_name}</td>
            <td class="text-right">{formatQty(position.quantity)}</td>
            <td class="text-right font-mono text-sm">{formatPrice(position.cost_price)}</td>
            <td
              class="text-right font-mono text-sm"
              role="button"
              tabindex="0"
              on:click={() => startEditPrice(position)}
              on:keydown={(e) => e.key === 'Enter' && startEditPrice(position)}>
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
                <span class="cursor-pointer hover:text-brand">{formatPrice(position.current_price)}</span>
              {/if}
            </td>
            <td class="text-right font-mono text-sm">{formatAmount(position.amount)}</td>
            <td class="text-right font-mono text-sm">
              {#if position.current_price != null && position.cost_price != null}
                {@const unrealizedPnl = (Number(position.current_price) - Number(position.cost_price)) * Number(position.quantity)}
                {@const realizedPnl = Number(position.realized_pnl ?? 0)}
                {@const totalPnl = unrealizedPnl + realizedPnl}
                <span class:font-medium={true} class:text-red-600={totalPnl > 0} class:text-green-600={totalPnl < 0}
                  >{totalPnl > 0 ? '+' : ''}{totalPnl.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              {:else}
                -
              {/if}
            </td>
            <td class="text-center text-sm">{formatDate(position.open_date)}</td>
            <td class="text-center text-sm">{getHoldingDays(position)}</td>
            <td class="text-center">
              <button
                on:click={() => handleSell(position)}
                class="rounded px-2 py-1 text-xs font-medium text-white
                  bg-orange-500 hover:bg-orange-600 transition-colors">
                {$_('sell')}
              </button>
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
        <SvgIcon
          name={showClosed ? 'chevron-down' : 'chevron-right'}
          width={16}
          height={16} />
        {$_('closedPositions')} ({closedPositions.length})
      </button>
      {#if showClosed}
        <Table>
          <thead>
            <tr>
              <th>{$_('securitySymbol')}</th>
              <th>{$_('securityName')}</th>
              <th class="text-right">{$_('quantity')}</th>
              <th class="text-center">{$_('openDate')}</th>
              <th class="text-center">{$_('closeDate')}</th>
              <th class="text-center">{$_('holdingDays')}</th>
              <th class="text-right">{$_('profitLoss')}</th>
            </tr>
          </thead>
          <tbody>
            {#each closedPositions as position (position.id)}
              <tr class="text-gray-400">
                <td class="font-mono text-sm">{position.security_symbol}</td>
                <td>{position.security_name}</td>
                <td class="text-right">{formatQty(position.quantity)}</td>
                <td class="text-center text-sm">{formatDate(position.open_date)}</td>
                <td class="text-center text-sm">{formatDate(position.close_date)}</td>
                <td class="text-center text-sm">{getHoldingDays(position)}</td>
                <td class="text-right font-mono text-sm" class:text-red-600={position.realized_pnl > 0} class:text-green-600={position.realized_pnl < 0}>
                  {formatPnl(position.realized_pnl)}
                </td>
              </tr>
            {/each}
          </tbody>
        </Table>
      {/if}
    {/if}
  {/if}
</div>
