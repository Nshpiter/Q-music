import { Platform, requireNativeComponent, type ModalProps, type ViewProps } from 'react-native'

const BackView = Platform.OS == 'android' && Number(Platform.Version) >= 33
  ? requireNativeComponent<ViewProps & { onModalBack: ModalProps['onRequestClose'] }>('QModalBackView')
  : null

// 此节点挂在 Dialog 内部，避免系统直接 dismiss 后 JS visible 仍为 true，导致下一次无法打开。
export default ({ onBack }: { onBack: ModalProps['onRequestClose'] }) => BackView
  ? <BackView collapsable={false} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" onModalBack={onBack} style={{ position: 'absolute', width: 1, height: 1 }} />
  : null
