import { Match, Show, Switch, type Accessor } from "solid-js"
import { Tabs } from "@opencode-ai/ui/tabs"

interface SessionMobileTabsProps {
  id: string | undefined
  isDesktop: boolean
  hasReview: boolean
  reviewCount: number
  language: any
  setMobileTab: (tab: "session" | "changes") => void
}

export function SessionMobileTabs(props: SessionMobileTabsProps) {
  return (
    <Show when={!props.isDesktop && props.id}>
      <Tabs class="h-auto">
        <Tabs.List>
          <Tabs.Trigger
            value="session"
            class="w-1/2"
            classes={{ button: "w-full" }}
            onClick={() => props.setMobileTab("session")}
          >
            {props.language.t("session.tab.session")}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="changes"
            class="w-1/2 !border-r-0"
            classes={{ button: "w-full" }}
            onClick={() => props.setMobileTab("changes")}
          >
            <Switch>
              <Match when={props.hasReview}>
                {props.language.t("session.review.filesChanged", { count: props.reviewCount })}
              </Match>
              <Match when={true}>{props.language.t("session.review.change.other")}</Match>
            </Switch>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>
    </Show>
  )
}
