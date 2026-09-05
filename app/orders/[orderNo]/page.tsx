"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, Clock, Copy, XCircle, Loader2, Check, CreditCard, User, ShieldCheck, Mail, Key, Globe, Hash } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import React from "react"

interface Order {
  id: string
  orderNo: string
  email: string | null
  totalAmount: any
  status: string
  couponId: string | null
  paymentMethod: string | null
  quantity: number
  paidAt: any
  product: {
    name: string
    deliveryFormat: string
  }
  licenses: {
    id: string
    code: string
  }[]
  createdAt: any
}

function CopyableField({ label, value, icon: Icon }: { label: string, value: string, icon?: any }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
          {Icon && <Icon className="h-3 w-3" />}
          {label}
        </span>
      </div>
      <div className="flex gap-2">
        <Input 
          readOnly 
          value={value} 
          className="bg-background/50 font-mono text-sm h-9 border-primary/10 focus-visible:ring-0 focus-visible:border-primary/30" 
        />
        <Button variant="secondary" size="icon" className="h-9 w-9 shrink-0 hover:bg-primary/10 hover:text-primary transition-colors" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function LicenseItem({ code, index, format }: { code: string, index: number, format: string }) {
  const [fullCopied, setFullCopied] = useState(false);

  const handleCopyFull = () => {
    navigator.clipboard.writeText(code);
    setFullCopied(true);
    setTimeout(() => setFullCopied(false), 2000);
  };

  // Normal / SINGLE format
  if (format === "SINGLE" || !format) {
    return (
      <div className="group bg-muted/30 p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-all">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">卡密 #{index + 1}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={handleCopyFull}>
            {fullCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        <code className="block bg-background/80 p-4 rounded-lg border font-mono text-lg break-all select-all text-primary font-bold">
          {code}
        </code>
      </div>
    );
  }

  // Account formats (using ----)
  if (format.startsWith("ACCOUNT_")) {
    const parts = code.split("----");
    const labels = format === "ACCOUNT_FULL" 
      ? ["账号", "密码", "辅助邮箱", "2FA 密钥"] 
      : ["账号", "密码"];
    const icons = [User, ShieldCheck, Mail, Key];

    return (
      <div className="group bg-muted/30 p-5 rounded-xl border border-border/50 hover:border-primary/30 transition-all space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">账号信息 #{index + 1}</span>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 border-primary/20 hover:border-primary/50" onClick={handleCopyFull}>
            {fullCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            复制完整格式
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {labels.map((label, i) => parts[i] && (
            <CopyableField key={label} label={label} value={parts[i]} icon={icons[i]} />
          ))}
        </div>
      </div>
    );
  }

  // Virtual Card format (using |)
  if (format === "VIRTUAL_CARD") {
    const parts = code.split("|");
    const labels = ["卡号", "有效期 (月/年)", "CVV 安全码"];
    const icons = [CreditCard, Clock, ShieldCheck];

    return (
      <div className="group bg-muted/30 p-5 rounded-xl border border-border/50 hover:border-primary/30 transition-all space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">虚拟卡信息 #{index + 1}</span>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 border-primary/20 hover:border-primary/50" onClick={handleCopyFull}>
            {fullCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            复制完整格式
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {labels.map((label, i) => parts[i] && (
            <CopyableField key={label} label={label} value={parts[i]} icon={icons[i]} />
          ))}
        </div>
      </div>
    );
  }

  // Proxy IP format (using :)
  if (format === "PROXY_IP") {
    const parts = code.split(":");
    const labels = ["主机 (Host)", "端口 (Port)", "用户 (User)", "密码 (Pass)"];
    const icons = [Globe, Hash, User, ShieldCheck];

    return (
      <div className="group bg-muted/30 p-5 rounded-xl border border-border/50 hover:border-primary/30 transition-all space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">代理信息 #{index + 1}</span>
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 border-primary/20 hover:border-primary/50" onClick={handleCopyFull}>
            {fullCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            复制完整格式
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {labels.map((label, i) => parts[i] && (
            <CopyableField key={label} label={label} value={parts[i]} icon={icons[i]} />
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default function OrderPage({ params }: { params: { orderNo: string } }) {
  const { orderNo } = params
  const searchParams = useSearchParams()
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [contact, setContact] = useState("")
  const [error, setError] = useState("")
  const [resuming, setResuming] = useState(false)
  const [paymentChannels, setPaymentChannels] = useState<{ id: string, name: string, provider: string }[]>([])
  const [paymentChannel, setPaymentChannel] = useState("")
  const [channelsLoading, setChannelsLoading] = useState(false)
  const requestVersion = useRef(0)
  const requestController = useRef<AbortController | null>(null)
  const orderStatus = order?.status
  const orderCouponId = order?.couponId
  const orderCreatedAt = order?.createdAt
  const orderPaymentMethod = order?.paymentMethod

  const fetchOrder = useCallback(async (quiet = false) => {
    const version = ++requestVersion.current
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    if (!quiet) {
      setLoading(true)
      setOrder(null)
    }
    setError("")
    try {
      const savedContact = sessionStorage.getItem(`geekfaka:order-contact:${orderNo}`)?.trim()
      if (!savedContact) {
        setOrder(null)
        return
      }
      setContact(savedContact)
      const res = await fetch(`/api/orders/${orderNo}`, {
        headers: { "X-Order-Contact": savedContact },
        signal: controller.signal
      })
      if (version !== requestVersion.current) return
      if (res.status === 404) {
        sessionStorage.removeItem(`geekfaka:order-contact:${orderNo}`)
        setOrder(null)
        setError("订单号或下单联系方式不匹配，请重新输入。")
        return
      }
      if (res.ok) {
        const data = await res.json()
        if (version !== requestVersion.current) return
        setOrder(data)
        return data.status as string
      } else {
        setError("暂时无法读取订单，请稍后重试。")
      }
    } catch (error) {
      if (controller.signal.aborted || version !== requestVersion.current) return
      setError("读取失败，请确认网络连接及浏览器会话存储可用后重试。")
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [orderNo])

  useEffect(() => () => {
    requestVersion.current++
    requestController.current?.abort()
  }, [orderNo])

  useEffect(() => {
    if (!(orderStatus === "PENDING" || (orderStatus === "EXPIRED" && orderCouponId))) return
    const controller = new AbortController()
    setChannelsLoading(true)
    fetch("/api/config/payments", { signal: controller.signal })
      .then(async res => {
        if (!res.ok) throw new Error("Payment channels unavailable")
        const data: { id: string, name: string, provider: string }[] = await res.json()
        if (controller.signal.aborted) return
        if (!Array.isArray(data)) throw new Error("Invalid payment channels")
        const channels = data.filter(channel => channel.provider === (orderPaymentMethod || "epay"))
        setPaymentChannels(channels)
        let saved = ""
        try {
          saved = sessionStorage.getItem(`geekfaka:order-channel:${orderNo}`) || ""
        } catch {
          console.warn("Unable to restore the previous payment channel")
        }
        setPaymentChannel(channels.some(channel => channel.id === saved) ? saved : channels[0]?.id || "")
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("支付方式读取失败，请刷新页面或稍后重试")
      })
      .finally(() => {
        if (!controller.signal.aborted) setChannelsLoading(false)
      })
    return () => controller.abort()
  }, [orderNo, orderStatus, orderPaymentMethod, orderCouponId])

  useEffect(() => {
    if (!orderCreatedAt || !(orderStatus === "PENDING" || (orderStatus === "EXPIRED" && orderCouponId))) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (stopped) return
      if (document.visibilityState !== "hidden") await fetchOrder(true)
      if (!stopped && (orderCouponId || new Date(orderCreatedAt).getTime() + 30 * 60 * 1000 > Date.now())) {
        timer = setTimeout(poll, 10000)
      }
    }
    timer = setTimeout(poll, 5000)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [orderStatus, orderCouponId, orderCreatedAt, fetchOrder])

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contact.trim()) return
    try {
      sessionStorage.setItem(`geekfaka:order-contact:${orderNo}`, contact.trim())
    } catch {
      setError("无法保存验证信息，请允许浏览器会话存储后重试。")
      return
    }
    await fetchOrder()
  }

  // Effect to sync payment status if URL has payment params
  useEffect(() => {
    const tradeStatus = searchParams.get("trade_status")
    
    const syncPayment = async () => {
      if (tradeStatus === "TRADE_SUCCESS") {
        setSyncing(true)
        try {
          const query = searchParams.toString()
          await fetch(`/api/payments/epay/notify?${query}`)
        } catch (e) {
          console.error("Sync failed", e)
        } finally {
          setSyncing(false)
          fetchOrder()
        }
      } else {
        fetchOrder()
      }
    }

    syncPayment()
  }, [orderNo, searchParams, fetchOrder])

  const handleCheckPayment = async () => {
    setChecking(true)
    try {
      const status = await fetchOrder(true)
      if (status === "PENDING" || status === "EXPIRED") {
        setError("暂未收到支付成功通知，请稍后刷新或联系客服。")
      }
    } finally {
      setChecking(false)
    }
  }

  const handleResumePayment = async () => {
    if (!paymentChannel) return
    setResuming(true)
    setError("")
    try {
      const res = await fetch(`/api/orders/${orderNo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Order-Contact": contact.trim() },
        body: JSON.stringify({ channel: paymentChannel })
      })
      const data = await res.json()
      if (!res.ok || typeof data.payUrl !== "string") {
        setError(data.error || "无法继续支付，请稍后重试")
        return
      }
      window.location.href = data.payUrl
    } catch {
      setError("无法连接支付服务，请稍后重试")
    } finally {
      setResuming(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background dark text-foreground">
        <Navbar />
        <div className="container mx-auto max-w-3xl py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background dark text-foreground">
        <Navbar />
        <div className="container mx-auto max-w-md py-20 px-4">
          <Card>
            <CardHeader>
              <CardTitle>验证下单联系方式</CardTitle>
              <p className="text-sm text-muted-foreground">请输入下单时填写的联系方式，以查看订单和卡密。</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <label htmlFor="order-contact" className="text-sm font-medium">下单联系方式</label>
                <Input
                  id="order-contact"
                  placeholder="邮箱 / QQ / 手机号"
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                  required
                />
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={!contact.trim()}>
                  验证并查看订单
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const reservedOrder = !!order.couponId && ["PENDING", "EXPIRED"].includes(order.status)
  const isExpired = !reservedOrder && (order.status === "EXPIRED" ||
    (order.status === "PENDING" && new Date(order.createdAt).getTime() + 30 * 60 * 1000 < Date.now()))

  return (
    <div className="min-h-screen bg-background dark text-foreground pb-20">
      <Navbar />
      <div className="container mx-auto max-w-3xl py-10 px-4">
        {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
        {syncing && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center gap-2 text-primary animate-pulse text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在同步支付状态，请稍候...
          </div>
        )}

        <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              {order.status === "PAID" ? (
                <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
              ) : isExpired ? (
                <div className="h-20 w-20 rounded-full bg-destructive/20 flex items-center justify-center">
                  <XCircle className="h-12 w-12 text-destructive" />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="h-12 w-12 text-yellow-500 animate-pulse" />
                </div>
              )}
            </div>
            <CardTitle className="text-3xl font-black tracking-tight">
              {order.status === "PAID" ? "支付成功" : isExpired ? "订单已过期" : "等待支付"}
            </CardTitle>
            <p className="text-muted-foreground mt-2 font-mono">#{order.orderNo}</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
             <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground block uppercase text-[10px] font-bold tracking-widest">商品名称</span>
                  <span className="font-bold text-base">{order.product.name}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block uppercase text-[10px] font-bold tracking-widest">支付金额</span>
                  <span className="font-bold text-xl text-primary font-mono">¥{Number(order.totalAmount).toFixed(2)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block uppercase text-[10px] font-bold tracking-widest">购买数量</span>
                  <span className="font-medium">{order.quantity} 个</span>
                </div>
                <div className="space-y-1">
                   <span className="text-muted-foreground block uppercase text-[10px] font-bold tracking-widest">联系方式</span>
                   <span className="font-medium">{order.email || "-"}</span>
                </div>
             </div>

             <Separator className="bg-border/50" />

             {order.status === "PAID" && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                 <div className="flex items-center gap-2 mb-4">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <h3 className="font-bold text-lg">您的卡密信息</h3>
                 </div>
                 <div className="space-y-4">
                   {order.licenses.map((license, index) => (
                     <LicenseItem 
                       key={license.id} 
                       code={license.code} 
                       index={index} 
                       format={order.product.deliveryFormat} 
                     />
                   ))}
                 </div>
               </div>
             )}

             {(order.status === "PENDING" || reservedOrder) && !isExpired && (
                <div className="text-center p-6 bg-yellow-500/5 text-yellow-600 rounded-xl border border-yellow-500/20 space-y-4">
                   <div className="space-y-2">
                     <p className="font-bold text-sm">付款完成后，请勿关闭此页面</p>
                     <p className="text-xs opacity-80">系统检测到支付成功后将自动展示卡密。</p>
                     {reservedOrder && <p className="text-xs">优惠码已为本订单预留，可继续支付原订单。</p>}
                   </div>
                   <label className="block text-left text-sm">
                     支付方式
                     <select className="mt-1 w-full rounded-md border bg-background p-2"
                       value={paymentChannel} onChange={event => setPaymentChannel(event.target.value)}
                       disabled={channelsLoading || resuming}>
                       {paymentChannels.length === 0 && <option value="">{channelsLoading ? "正在读取…" : "暂无可用支付方式"}</option>}
                       {paymentChannels.map(channel => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                     </select>
                   </label>
                   <Button className="w-full" onClick={handleResumePayment} disabled={resuming || !paymentChannel || channelsLoading}>
                     {resuming ? "正在打开支付…" : "继续支付原订单"}
                   </Button>
                   <Button 
                     variant="outline" 
                     className="w-full border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-700"
                     onClick={handleCheckPayment}
                     disabled={checking}
                   >
                     {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     我已支付，点击刷新
                   </Button>
                </div>
             )}

             {isExpired && (
                <div className="text-center p-6 bg-destructive/5 text-destructive rounded-xl border border-destructive/20">
                   订单超时未支付，已自动关闭。请返回首页重新下单。
                </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
