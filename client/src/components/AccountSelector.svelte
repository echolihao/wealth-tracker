<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { getSecuritiesAccounts } from '../helper/apis'
  import Skeleton from './Skeleton.svelte'

  const dispatch = createEventDispatcher()

  export let selectedAccount: any = null

  let accounts: any[] = []
  let loading = true

  onMount(() => {
    fetchAccounts()
  })

  const fetchAccounts = async () => {
    loading = true
    try {
      const data = await getSecuritiesAccounts()
      accounts = data || []
      if (accounts.length > 0 && !selectedAccount) {
        selectedAccount = accounts[0]
        dispatch('select', accounts[0])
      }
    } catch (error) {
      console.error('Error fetching securities accounts:', error)
    } finally {
      loading = false
    }
  }

  const handleSelect = (account: any) => {
    selectedAccount = account
    dispatch('select', account)
  }

  const getTotalAmount = (account: any) => {
    return Number(account.amount || 0)
  }

  const formatAmount = (value: number) => {
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
</script>

<div class="mb-6 w-full">
  {#if loading}
    <div class="space-y-2">
      <Skeleton width="w-48" height="h-6" />
      <Skeleton width="w-32" height="h-4" />
    </div>
  {:else if accounts.length === 0}
    <div class="rounded-lg border border-dashed border-gray-300 p-6 text-center">
      <p class="mb-2 text-gray-500">{$_('noSecuritiesAccount')}</p>
      <a href="/" class="comfirm-btn inline-block rounded px-4 py-2 text-sm font-medium text-white">
        {$_('goToAdd')}
      </a>
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-3">
      {#each accounts as account}
        <button
          on:click={() => handleSelect(account)}
          class="focus-visible-ring rounded-lg border px-4 py-3 text-left transition-all
          {selectedAccount?.type === account.type
            ? 'border-brand bg-brand/5 shadow-sm'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}">
          <div class="flex items-center gap-3">
            <span class="font-medium">
              {account.alias || account.type.replace('securities:', '')}
            </span>
            <span class="text-lg font-semibold text-brand">
              ¥{formatAmount(getTotalAmount(account))}
            </span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
