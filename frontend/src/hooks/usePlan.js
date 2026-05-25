import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

/**
 * Fetch and cache the current user's plan + payment status.
 * Returns { plan, paymentStatus, priceThb, pendingSince, loading, refresh }
 *
 * plan          : 'free' | 'pro'
 * paymentStatus : null | 'pending' | 'approved'
 * pendingSince  : ISO string or null
 */
export function usePlan() {
  const [plan,          setPlan]          = useState('free')
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [priceThb,      setPriceThb]      = useState(99)
  const [pendingSince,  setPendingSince]  = useState(null)
  const [loading,       setLoading]       = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/payment/status')
      setPlan(data.plan)
      setPaymentStatus(data.payment_status)
      setPriceThb(data.price_thb ?? 299)
      setPendingSince(data.pending_since ?? null)
    } catch {
      // Not logged in yet or network error — keep defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { plan, paymentStatus, priceThb, pendingSince, loading, refresh }
}
