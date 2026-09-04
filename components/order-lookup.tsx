"use client"

import { useState } from "react"
import { Search, Loader2, Calendar, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export function OrderLookup() {
  const [open, setOpen] = useState(false)
  const [orderNo, setOrderNo] = useState("")
  const [contact, setContact] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!orderNo.trim() || !contact.trim()) return

    setLoading(true)
    setHasSearched(false)
    setResults([])
    setError("")

    try {
      const res = await fetch("/api/orders/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo: orderNo.trim(), contact: contact.trim() })
      })
      if (!res.ok) {
        setError("查询失败，请稍后重试。")
        return
      }
      const data = await res.json()
      
      if (Array.isArray(data)) {
        for (const order of data) {
          sessionStorage.setItem(`geekfaka:order-contact:${order.orderNo}`, contact.trim())
        }
        setResults(data)
      } else {
        setResults([])
      }
    } catch {
      setError("查询失败，请确认浏览器允许会话存储后重试。")
    } finally {
      setLoading(false)
      setHasSearched(true)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "PAID": return <Badge className="bg-green-500 hover:bg-green-600 px-1.5 py-0 text-[10px] h-5">已支付</Badge>
      case "PENDING": return <Badge variant="secondary" className="text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0 text-[10px] h-5">待支付</Badge>
      case "EXPIRED": return <Badge variant="destructive" className="px-1.5 py-0 text-[10px] h-5">已过期</Badge>
      default: return <Badge variant="outline" className="px-1.5 py-0 text-[10px] h-5">{status}</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm">
          <Search className="h-4 w-4 text-primary" />
          <span className="font-bold">查询订单</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>订单查询</DialogTitle>
          <DialogDescription>
            输入订单号和下单时填写的联系方式（邮箱/QQ/手机号）查询。
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSearch} className="space-y-3 mt-2">
          <label htmlFor="lookup-order-no" className="text-sm font-medium">订单号</label>
          <Input 
            id="lookup-order-no"
            placeholder="订单号"
            value={orderNo}
            onChange={e => setOrderNo(e.target.value)}
            required
          />
          <label htmlFor="lookup-contact" className="text-sm font-medium">下单联系方式</label>
          <Input
            id="lookup-contact"
            placeholder="下单联系方式（邮箱/QQ/手机号）"
            value={contact}
            onChange={e => setContact(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading || !orderNo.trim() || !contact.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "查询"}
          </Button>
        </form>

        <div className="mt-4">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {!error && hasSearched && results.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
              <p>未找到相关订单</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {results.map((order) => (
                <Link 
                  key={order.orderNo} 
                  href={`/orders/${order.orderNo}`}
                  onClick={() => setOpen(false)}
                  className="block group"
                >
                  <div className="border rounded-lg p-3 hover:bg-accent/50 transition-colors flex items-center justify-between">
                      <div className="space-y-2 flex-1 mr-4">
                        <div className="font-bold text-sm leading-tight text-foreground/90">
                          {order.product.name}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {getStatusBadge(order.status)}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatDate(order.createdAt)}
                          </span>
                          <span className="font-mono font-medium text-foreground">
                            ¥{Number(order.totalAmount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
