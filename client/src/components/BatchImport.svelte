<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  import SvgIcon from './SvgIcon.svelte'
  import { importTrades } from '../helper/apis'
  import { alert, notice } from '../stores'

  const dispatch = createEventDispatcher()

  export let assetId: number | string = ''
  export let show = false

  let selectedFile: File | null = null
  let importing = false
  interface ImportResult {
    success: boolean
    imported: number
    errors: Array<{ row: number; field: string; message: string }>
    details: string
  }

  let result: ImportResult | null = null

  // CSV template content
  const CSV_HEADER = '交易日期,操作类型,证券代码,证券名称,数量,价格,金额,备注'

  const handleDownloadTemplate = () => {
    const blob = new Blob(['﻿' + CSV_HEADER], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'trade-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      selectedFile = target.files[0]
      result = null
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      alert.set($_('selectCsvFile'))
      return
    }

    importing = true
    result = null
    try {
      const res: any = await importTrades(assetId, selectedFile)
      result = res
      if (res.success) {
        notice.set(
          $_('importSuccess', { values: { count: res.imported } }),
        )
        dispatch('imported')
      }
    } catch (error: any) {
      // error from ajax.ts .catch: err.response.data (the response body)
      if (error && error.errors) {
        result = error
      } else if (error?.response?.data?.errors) {
        result = error.response.data
      } else {
        const msg = error?.response?.data?.message || error.message || 'Network error'
        result = {
          success: false,
          imported: 0,
          errors: [{ row: 0, field: '系统', message: msg }],
          details: `导入失败：${msg}`,
        }
      }
    } finally {
      importing = false
    }
  }

  const handleClose = () => {
    show = false
    selectedFile = null
    result = null
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    on:click={handleClose}>
    <div
      class="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
      on:click|stopPropagation>
      <!-- Header -->
      <div class="mb-4 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-lg font-medium">
          <SvgIcon name="adjustment" width={20} height={20} color="#1e293b" />
          {$_('batchImport')}
        </h3>
        <button on:click={handleClose} class="text-gray-400 hover:text-gray-600">
          <SvgIcon name="close" width={20} height={20} />
        </button>
      </div>

      <!-- Template download -->
      <div class="mb-4">
        <button
          on:click={handleDownloadTemplate}
          class="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
          <SvgIcon name="download" width={16} height={16} />
          {$_('downloadTemplate')}
        </button>
      </div>

      <!-- File select -->
      <div class="mb-4">
        <label class="custom-label block mb-1">{$_('selectFile')}</label>
        <input
          type="file"
          accept=".csv"
          on:change={handleFileSelect}
          class="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100" />
        {#if selectedFile}
          <p class="mt-1 text-xs text-gray-500">
            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
        {:else}
          <p class="mt-1 text-xs text-gray-400">{$_('noFileSelected')}</p>
        {/if}
      </div>

      <!-- Import button -->
      <button
        on:click={handleImport}
        disabled={importing || !selectedFile}
        class="w-full rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50
          {result?.success ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}">
        {importing
          ? $_('persist') + '...'
          : result?.success
            ? $_('close')
            : $_('import')}
      </button>

      <!-- Result display -->
      {#if result && !result.success && result.errors.length > 0}
        <div class="mt-4 max-h-60 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3">
          <p class="mb-2 text-sm font-medium text-red-700">{$_('importFailed')}</p>
          <p class="mb-2 text-xs text-red-600">{result.details}</p>
          {#each result.errors as err}
            <div class="mb-1 rounded bg-white px-2 py-1 text-xs text-red-600">
              {#if err.row > 0}
                <span class="font-mono">第 {err.row} 行</span>
                <span class="mx-1">·</span>
              {/if}
              <span class="font-medium">{err.field}:</span> {err.message}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
