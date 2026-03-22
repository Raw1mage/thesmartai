# Proposal

## Why

- runner 現在已具備兩個前提：
  1. approved mission authority
  2. approved mission consumption baseline
- 但目前 autonomous flow 仍只會產生 generic continuation text，尚未真正依 mission 內容決定「該由哪種 execution role 接手下一步」。
- 若沒有 delegated execution baseline，runner 仍然只是會讀 spec 的 prompt loop，而不是能依 spec 啟動受控委派的 execution owner。

## What Changes

- 定義 delegated execution baseline：讓 runner 能從 approved mission + actionable todo 推出最小 delegation hint。
- 第一輪只做 bounded role selection / continuation contract，不直接實作完整多代理編排引擎。
