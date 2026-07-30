import { useEffect } from 'react'

import Vertical from './Vertical'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'

export default ({ componentId }: { componentId: string }) => {
  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <PageContent>
      <StatusBar />
      <Vertical componentId={componentId} />
    </PageContent>
  )
}
