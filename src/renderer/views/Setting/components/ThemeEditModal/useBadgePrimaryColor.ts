import useColorPicker from '@renderer/utils/compositions/useColorPicker'

export default () => {
  const { colorRef, init, destroy, setColor } = useColorPicker()

  return {
    badge_primary_color_ref: colorRef,
    initBadgePrimaryColor: init,
    destroyBadgePrimaryColor: destroy,
    setBadgePrimaryColor: setColor,
  }
}
