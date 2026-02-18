import axios from "axios"

export const http = axios.create({
  timeout: 20_000,
  headers: {
    "User-Agent": "ShintokuPlatformBot/1.0 (+https://github.com/shintoku-platform)",
  },
})
