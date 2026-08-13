import { ASCIIFont, Text, Box } from "@opentui/core"

export function renderBanner(title: string, subtitle?: string) {
  return Box(
    { flexDirection: "column", width: "100%" },
    ASCIIFont({ text: title, font: "tiny" }),
    subtitle
      ? Text({ content: subtitle, paddingLeft: 1, paddingTop: 1 })
      : Text({ content: "", paddingTop: 1 }),
    Text({ content: "", paddingTop: 1 }),
  )
}
