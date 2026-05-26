"use client"

import dynamic from "next/dynamic"
import { useCallback, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react"
import type { ICommand, TextAreaTextApi } from "@uiw/react-md-editor"
import { cn } from "@/lib/utils"
import "@uiw/react-md-editor/markdown-editor.css"
import "@uiw/react-markdown-preview/markdown.css"

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(
  () => import("@uiw/react-md-editor"),
  { ssr: false }
)

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

function insertTextAtCursor(textarea: HTMLTextAreaElement, text: string) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const nextValue = textarea.value.slice(0, start) + text + textarea.value.slice(end)

  textarea.value = nextValue
  textarea.setSelectionRange(start + text.length, start + text.length)
  textarea.dispatchEvent(new Event("input", { bubbles: true }))
}

function getImageMarkdown(file: File, url: string) {
  const alt = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[\[\]()\r\n]/g, "")
    .trim() || "image"

  return `\n![${alt}](${url})\n`
}

export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textApiRef = useRef<TextAreaTextApi | null>(null)

  const uploadImage = useCallback(async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch("/api/admin/uploads", {
      method: "POST",
      body: formData,
    })
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || "图片上传失败")
    }

    return data.url as string
  }, [])

  const insertMarkdown = useCallback((markdown: string, target?: TextAreaTextApi | HTMLTextAreaElement | null) => {
    if (target instanceof HTMLTextAreaElement) {
      insertTextAtCursor(target, markdown)
      return
    }

    if (target) {
      target.replaceSelection(markdown)
      return
    }

    onChange(`${value}${value.endsWith("\n") || !value ? "" : "\n"}${markdown}`)
  }, [onChange, value])

  const handleImageFile = useCallback(async (file: File, target?: TextAreaTextApi | HTMLTextAreaElement | null) => {
    setUploading(true)
    try {
      const url = await uploadImage(file)
      insertMarkdown(getImageMarkdown(file, url), target)
    } catch (error: any) {
      alert(error.message || "图片上传失败")
    } finally {
      setUploading(false)
    }
  }, [insertMarkdown, uploadImage])

  const uploadImageCommand: ICommand = useMemo(() => ({
    name: "upload-image",
    keyCommand: "upload-image",
    buttonProps: {
      "aria-label": "上传图片",
      title: uploading ? "图片上传中..." : "上传图片",
      disabled: uploading,
    },
    icon: (
      <svg width="13" height="13" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M10 2a1 1 0 0 1 1 1v6.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42L9 9.59V3a1 1 0 0 1 1-1ZM4 14a1 1 0 0 1 1 1v1h10v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
        />
      </svg>
    ),
    execute: (_state, api) => {
      textApiRef.current = api
      fileInputRef.current?.click()
    },
  }), [uploading])

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    await handleImageFile(file, textApiRef.current)
  }

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const image = Array.from(event.clipboardData.files).find(file => file.type.startsWith("image/"))
      || Array.from(event.clipboardData.items)
        .find(item => item.type.startsWith("image/"))
        ?.getAsFile()
    if (!image) return

    event.preventDefault()
    await handleImageFile(image, event.currentTarget)
  }

  return (
    <div className={cn("min-h-[300px] h-full", className)} data-color-mode="dark">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || "")}
        height="100%"
        className="h-full border border-input rounded-md overflow-hidden bg-background"
        preview="live"
        commandsFilter={(command) => command.name === "help" || command.keyCommand === "help" ? uploadImageCommand : command}
        textareaProps={{
          onPaste: handlePaste,
        }}
      />
    </div>
  )
}
