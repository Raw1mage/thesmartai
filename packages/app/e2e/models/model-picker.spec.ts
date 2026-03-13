import { test, expect } from "../fixtures"
import { promptSelector } from "../selectors"
import { clickListItem } from "../actions"

test("model manager only applies draft selection after submit", async ({ page, gotoSession }) => {
  await gotoSession()

  const form = page.locator(promptSelector).locator("xpath=ancestor::form[1]")
  const currentFooterLabel = (await form.locator('[data-component="button"]').nth(1).innerText()).trim()

  await page.locator(promptSelector).click()
  await page.keyboard.type("/model")

  const command = page.locator('[data-slash-id="model.choose"]')
  await expect(command).toBeVisible()
  await command.hover()

  await page.keyboard.press("Enter")

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  const modeSwitch = dialog.getByRole("switch").first()
  await expect(modeSwitch).toBeVisible()
  await modeSwitch.click()

  const providerButton = dialog.getByRole("button", { name: /^opencode/i }).first()
  await expect(providerButton).toBeVisible()
  await providerButton.click()

  const selected = dialog.locator('[data-slot="list-item"][data-selected="true"]').first()
  const other = dialog.locator('[data-slot="list-item"]:not([data-selected="true"])').first()
  const fallback = dialog.locator('[data-slot="list-item"]').first()
  const target = (await other.count()) > 0 ? other : (await selected.count()) > 0 ? selected : fallback
  await expect(target).toBeVisible()

  const key = await target.getAttribute("data-key")
  if (!key) throw new Error("Failed to resolve model key from list item")

  const name = (await target.locator("span").first().innerText()).trim()

  await clickListItem(dialog, { key })

  const submit = dialog.getByRole("button", { name: /^submit$/i })
  await expect(submit).toBeVisible()
  await expect(form.locator('[data-component="button"]').filter({ hasText: currentFooterLabel }).first()).toBeVisible()
  await expect(form.locator('[data-component="button"]').filter({ hasText: name }).first()).toHaveCount(0)

  await submit.click()

  await expect(form.locator('[data-component="button"]').filter({ hasText: name }).first()).toBeVisible()
  await expect(submit).toHaveCount(0)
})
