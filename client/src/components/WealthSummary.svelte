<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { getCurrencySymbol } from './../helper/utils'
  import {
    customCurrencies,
    netWorthValue,
    targetCurrencyCode,
    totalAssetValue,
    totalLiabilityValue,
  } from './../stores'

  $: currencySymbol = getCurrencySymbol($targetCurrencyCode, $customCurrencies)
</script>

<div class="grid w-full grid-cols-3 gap-4 md:grid-cols-1 md:gap-2">
  <div class="rounded-lg border border-gray-200 bg-white p-4 text-center">
    <p class="text-sm font-light text-black">{$_('totalAssets')}</p>
    <strong class="text-blue text-xl font-extrabold md:text-lg">
      {currencySymbol}{$totalAssetValue}
    </strong>
  </div>
  <div class="rounded-lg border border-gray-200 bg-white p-4 text-center">
    <p class="text-sm font-light text-black">{$_('totalLiabilities')}</p>
    <strong
      class="text-xl font-extrabold md:text-lg {$totalLiabilityValue > 0
        ? 'text-mark'
        : 'text-blue'}">
      {currencySymbol}{$totalLiabilityValue}
    </strong>
  </div>
  <div class="border-brand rounded-lg border bg-yellow-50 p-4 text-center">
    <p class="text-sm font-light text-black">{$_('netWorth')}</p>
    <strong class="text-brand text-xl font-extrabold md:text-lg">
      {currencySymbol}{$netWorthValue}
    </strong>
  </div>
</div>
