import useColorPicker from '@renderer/utils/compositions/useColorPicker'

export default () => {
  const { colorRef, init, destroy, setColor } = useColorPicker([
    'rgba(231, 170, 54, 1)',
    'rgba(92, 191, 155, 1)',
    'rgba(54, 196, 231, 1)',
    'rgba(158, 212, 88, 1)',
    'rgba(223, 187, 107, 1)',
    'rgba(245, 182, 132, 1)',
    'rgba(229, 163, 159, 1)',
    'rgba(177, 155, 159, 1)',
    'rgba(99, 118, 162, 1)',
    'rgba(176, 128, 219, 1)',
    'rgba(175, 148, 121, 1)',
    'rgba(223, 187, 107, 1)',
    'rgba(49.11, 161.05, 135.64, 1)',
  ])

  return {
    badge_tertiary_color_ref: colorRef,
    initBadgeTertiaryColor: init,
    destroyBadgeTertiaryColor: destroy,
    setBadgeTertiaryColor: setColor,
  }
}
