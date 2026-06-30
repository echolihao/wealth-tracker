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
  $: closedPositions = positions.filter((p: any) => p.status === 'Closed')

  const formatPrice = (value: any) => {
    if (value === null || value === undefined) return '-'
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
  }

  const formatQty = (value: any) => {
    return Number(value).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
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
          <th class="text-right">{$_('tradeAmount')}</th>
          <th class="text-center">{$_('action')}</th>
        </tr>
      </thead>
      <tbody>
        {#each openPositions as position (position.security_symbol)}
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
            <td class="text-right font-mono text-sm">{formatPrice(position.amount)}</td>
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
              <th class="text-right">{$_('costPrice')}</th>
              <th class="text-right">{$_('tradeAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {#each closedPositions as position (position.security_symbol)}
              <tr class="text-gray-400">
                <td class="font-mono text-sm">{position.security_symbol}</td>
                <td>{position.security_name}</td>
                <td class="text-right font-mono text-sm">{formatPrice(position.cost_price)}</td>
                <td class="text-right font-mono text-sm">{formatPrice(position.amount)}</td>
              </tr>
            {/each}
          </tbody>
        </Table>
      {/if}
    {/if}
  {/if}
</div>
