import { useEffect, useMemo } from 'react'
import dayjs from 'dayjs'

/**
 * 演示防护：给外部分享链接时降低被随手扒走/截图外传的风险。
 * 通过地址栏参数控制：
 *   ?ref=张三   署名（水印显示受邀人，截图外传可追溯到人）
 *   ?guard=0    关闭全部防护（自己调试用）
 */

export interface GuardParams {
  /** 受邀人标识，来自 ?ref= */
  guest: string
  /** 是否启用防护，?guard=0 关闭 */
  enabled: boolean
}

export function useGuardParams(): GuardParams {
  const search = typeof window === 'undefined' ? '' : window.location.search
  const q = new URLSearchParams(search)
  return {
    guest: q.get('ref') || q.get('from') || '',
    enabled: q.get('guard') !== '0',
  }
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case "'":
        return '&apos;'
      default:
        return '&quot;'
    }
  })
}

/** 全屏半透明水印，截图/录屏都会带上，可追溯到受邀人与时间 */
export function Watermark({
  label,
  guest,
  enabled = true,
}: {
  label?: string
  guest?: string
  enabled?: boolean
}) {
  const text = useMemo(() => {
    const main = label || '内部演示 · 请勿外传'
    const who = guest ? `受邀人 ${guest}` : '未署名访客'
    const when = dayjs().format('YYYY-MM-DD HH:mm')
    return `${main} · ${who} · ${when}`
  }, [label, guest])

  const bg = useMemo(() => {
    const safe = escapeXml(text)
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="230">` +
      `<text x="10" y="86" transform="rotate(-22 10 86)" ` +
      `fill="rgba(15,23,42,0.075)" font-size="15" ` +
      `font-family="-apple-system,Segoe UI,Microsoft YaHei,sans-serif">${safe}</text>` +
      `</svg>`
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
  }, [text])

  if (!enabled) return null
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        backgroundImage: bg,
        backgroundRepeat: 'repeat',
      }}
    />
  )
}

/** 屏蔽右键菜单、复制/剪切、开发者工具与保存/打印快捷键 */
export function useContentGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const block = (e: Event) => {
      e.preventDefault()
    }
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key || '').toUpperCase()
      if (k === 'F12') return block(e)
      if (e.ctrlKey && e.shiftKey && (k === 'I' || k === 'J' || k === 'C')) return block(e)
      if (e.ctrlKey && (k === 'U' || k === 'S' || k === 'P')) return block(e)
      if (e.metaKey && e.altKey && (k === 'I' || k === 'J')) return block(e)
    }
    document.addEventListener('contextmenu', block)
    document.addEventListener('copy', block)
    document.addEventListener('cut', block)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('copy', block)
      document.removeEventListener('cut', block)
      document.removeEventListener('keydown', onKey)
    }
  }, [enabled])
}
