export function shouldAutoOpenProvidersPage(args: {
  didAutoOpenProviders: boolean
  targetProviderID?: string
  page: "activities" | "providers"
  step: "root" | "account_select" | "model_select"
  activityTotal: number
}) {
  if (args.didAutoOpenProviders) return false
  if (args.targetProviderID) return false
  if (args.page !== "activities") return false
  if (args.step !== "root") return false
  if (args.activityTotal !== 0) return false
  return true
}
