import { createContext, useContext } from 'react'

// 首页浮动底栏的实测高度；独立页面和弹窗默认不预留底栏空间。
export const DockInsetContext = createContext(0)
export const useDockInset = () => useContext(DockInsetContext)
