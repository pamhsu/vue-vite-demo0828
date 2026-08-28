import { defineStore } from "pinia";

export const useMemberStore =
    defineStore("member", {
        state: () => ({
            user: JSON.parse(localStorage.getItem("member")) || null,
            members: JSON.parse(localStorage.getItem("members")) || []
        }),
        getters: {
            isLoggedIn(state) {
                return !!state.user
            },
            userName(state) {
                return state.user ? state.user.name : ""
            }
        },
        actions: {
            async register(name, email, password) {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                })
                const data = await response.json()
                return { success: response.ok, message: data.message || '註冊失敗' }
            },
            async login(email, password) {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                })
                const data = await response.json()
                if (!response.ok) return { success: false, message: data.message || '帳號或密碼錯誤' }
                this.user = data.member
                localStorage.setItem("member", JSON.stringify(this.user))
                return { success: true, message: "登入成功" }
            },
            logout() {
                this.user = null
                localStorage.removeItem("member")
            }
        }
    })
