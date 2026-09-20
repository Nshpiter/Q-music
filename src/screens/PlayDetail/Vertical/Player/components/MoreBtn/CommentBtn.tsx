import Btn from './Btn'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'


export default () => {
  const handleShowCommentScreen = () => {
    navigations.pushCommentScreen(commonState.componentIds.playDetail!)
  }

  return <Btn icon="comment" label={global.i18n.t('mobile_comments')} accessibilityLabel={global.i18n.t('comment_show_text')} onPress={handleShowCommentScreen} />
}
