<script lang="ts">
  import { params } from '@roxi/routify'
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import Header from '../components/Header.svelte'
  import Footer from '../components/Footer.svelte'
  import AccountSelector from '../components/AccountSelector.svelte'
  import PositionsTable from '../components/PositionsTable.svelte'
  import TradeForm from '../components/TradeForm.svelte'
  import TradeHistory from '../components/TradeHistory.svelte'
  import { getPositions, getTrades } from '../helper/apis'
  import { updatePageMetaInfo } from '../helper/utils'
  import { notice } from '../stores'

  let selectedAccount: any = null
  let positions: any[] = []
  let trades: any[] = []
  let tradeTotal = 0
  let tradePage = 1
  let tradeSize = 10
  let loadingPositions = false
  let loadingTrades = false

  onMount(() => {
    updatePageMetaInfo({
      title: $_('tradePage'),
    })
  })

  const handleAccountSelect = async (event: CustomEvent) => {
    selectedAccount = event.detail
    tradePage = 1
    await Promise.all([fetchPositions(), fetchTrades()])
  }

  const fetchPositions = async () => {
    if (!selectedAccount) return
    loadingPositions = true
    try {
      positions = (await getPositions(selectedAccount.type)) || []
    } catch (error) {
      console.error('Error fetching positions:', error)
      notice.set('Failed to load positions')
    } finally {
      loadingPositions = false
    }
  }

  const fetchTrades = async () => {
    if (!selectedAccount) return
    loadingTrades = true
    try {
      const result = await getTrades(selectedAccount.type, {
        page: tradePage,
        size: tradeSize,
      })
      trades = result.data || []
      tradeTotal = result.total || 0
    } catch (error) {
      console.error('Error fetching trades:', error)
      notice.set('Failed to load trades')
    } finally {
      loadingTrades = false
    }
  }

  const handleTradeCreated = () => {
    Promise.all([fetchPositions(), fetchTrades()])
  }

  const handlePositionUpdated = () => {
    fetchPositions()
  }

  const handleTradeDeleted = () => {
    Promise.all([fetchPositions(), fetchTrades()])
  }

  const handlePageChange = (event: CustomEvent) => {
    tradePage = event.detail
    fetchTrades()
  }

  const handleSell = (event: CustomEvent) => {
    // Forward sell data to TradeForm component
    const tradeForm = document.querySelector('#trade-form-component') as any
    if (tradeForm && tradeForm.selectSell) {
      tradeForm.selectSell({
        symbol: event.detail.security_symbol,
        name: event.detail.security_name,
      })
    }
  }
</script>

<Header />

<div class="flex w-full flex-col items-center justify-center px-4">
  <div class="w-full max-w-5xl">
    <h2 class="mb-6 mt-4 text-xl font-semibold">{$_('tradePage')}</h2>

    <AccountSelector
      bind:selectedAccount
      on:select={handleAccountSelect} />

    {#if selectedAccount}
      <div class="mb-6">
        <h3 class="mb-3 text-base font-medium">{$_('positions')}</h3>
        <PositionsTable
          {positions}
          loading={loadingPositions}
          assetType={selectedAccount.type}
          on:sell={handleSell}
          on:priceUpdated={handlePositionUpdated} />
      </div>

      <div class="mb-6" id="trade-form-component">
        <TradeForm
          assetType={selectedAccount.type}
          on:created={handleTradeCreated} />
      </div>

      <div class="mb-6">
        <TradeHistory
          {trades}
          total={tradeTotal}
          page={tradePage}
          size={tradeSize}
          loading={loadingTrades}
          on:deleted={handleTradeDeleted}
          on:pageChange={handlePageChange} />
      </div>
    {:else}
      <div class="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-400">
        {$_('selectAccount')}
      </div>
    {/if}
  </div>
</div>

<Footer />
