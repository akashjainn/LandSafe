'use client'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function GoogleAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // inject tag once
  useEffect(() => {
    if (!GA_ID) return
    if (document.getElementById('ga-tag')) return
    const s1 = document.createElement('script')
    s1.async = true
    s1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    const s2 = document.createElement('script')
    s2.id = 'ga-tag'
    s2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      // SPA: we'll manually send page_view below
      gtag('config', '${GA_ID}', { anonymize_ip: true, send_page_view: false });
    `
    document.head.appendChild(s1)
    document.head.appendChild(s2)
  }, [])

  // send a page_view whenever route/search changes
  useEffect(() => {
    if (!GA_ID) return
    window.gtag?.('event', 'page_view', { page_location: window.location.href })
  }, [pathname, searchParams])

  return null
}
