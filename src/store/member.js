import { defineStore } from "pinia";
import { memberAuthHeaders, storedMember } from "../services/memberAuth.js";

export const useMemberStore =
    defineStore("member", {
        state: () => ({
            user: storedMember(),
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
                if (!response.ok) return { success: false, disabled: !!data.disabled, message: data.message || '帳號或密碼錯誤' }
                this.user = data.member
                localStorage.setItem("memberToken", data.token)
                localStorage.setItem("member", JSON.stringify(this.user))
                return { success: true, message: "登入成功" }
            },
            logout() {
                fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: memberAuthHeaders()
                }).catch(() => {})
                this.user = null
                localStorage.removeItem("member")
                localStorage.removeItem("memberToken")
            },
            async updateProfile(payload) {
                const response = await fetch(`/api/me/${this.user.id}`, {
                    method: 'PUT',
                    headers: memberAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(payload)
                })
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}))
                    return { success: false, message: data.message || '更新失敗' }
                }
                this.user = { ...this.user, ...payload }
                localStorage.setItem("member", JSON.stringify(this.user))
                return { success: true, message: "資料已更新" }
            },
            async changePassword(oldPassword, newPassword) {
                const response = await fetch(`/api/me/${this.user.id}/password`, {
                    method: 'POST',
                    headers: memberAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ oldPassword, newPassword })
                })
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}))
                    return { success: false, message: data.message || '更改密碼失敗' }
                }
                return { success: true, message: "密碼已更新" }
            }
        }
    })
