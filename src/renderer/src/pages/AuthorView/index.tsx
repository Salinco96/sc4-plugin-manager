import { values } from "@salinco/nice-utils"
import { useTranslation } from "react-i18next"

import type { AuthorID } from "@common/authors"
import { AuthorHeader } from "@components/AuthorHeader"
import AuthorViewPackages from "@components/AuthorViewTabs/AuthorViewPackages"
import AuthorViewTools from "@components/AuthorViewTabs/AuthorViewTools"
import { Empty } from "@components/Empty"
import { Loader } from "@components/Loader"
import { type TabInfo, Tabs } from "@components/Tabs"
import { View } from "@components/View"
import { store } from "@stores/main"

const tabs: TabInfo<{ authorId: AuthorID }>[] = [
  {
    id: "packages",
    component: AuthorViewPackages,
    count({ authorId }, { packages = {} }) {
      return values(packages).filter(({ variants }) =>
        values(variants).some(variant => !variant.disabled && variant.authors.includes(authorId)),
      ).length
    },
    fullsize: true,
    label(t, count) {
      return t("packages", { count })
    },
  },
  {
    id: "tools",
    component: AuthorViewTools,
    count({ authorId }, { tools = {} }) {
      return values(tools).filter(tool => !tool.disabled && tool.authors?.includes(authorId)).length
    },
    fullsize: true,
    label(t, count) {
      return t("tools", { count })
    },
  },
]

function AuthorView({ authorId }: { authorId: AuthorID }): JSX.Element {
  const exists = store.useStore(state => state.authors && !!state.authors[authorId])

  const { t } = useTranslation("AuthorView")

  // Loading
  if (exists === undefined) {
    return (
      <View>
        <Loader />
      </View>
    )
  }

  // Missing
  if (exists === false) {
    return (
      <View>
        <Empty message={t("missing", { authorId })} />
      </View>
    )
  }

  return (
    <View>
      <AuthorHeader authorId={authorId} />
      <Tabs tabs={tabs} authorId={authorId} />
    </View>
  )
}

export default AuthorView
