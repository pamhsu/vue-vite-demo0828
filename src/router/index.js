import { createRouter, createWebHistory } from "vue-router"

const routes = [
  {
    path: "/",
    name: "home",
    component: () => import("../views/HomeView.vue"),
    meta: { layout: "default" }
  },
  {
    path: "/products",
    name: "products",
    component: () => import("../views/ProductsView.vue"),
    meta: { layout: "default" }
  },
  {
    path: "/about",
    name: "about",
    component: () => import("../views/AboutView.vue"),
    meta: { layout: "default" }
  },
  {
    path: "/products/:id",
    name: "productDetail",
    component: () => import("../views/ProductDetailView.vue"),
    meta: { layout: "default" }
  },
  {
    path: "/products/category/:category",
    name: "category",
    component: () => import("../views/CategoryProductView.vue"),
    meta: { layout: "default" }
  },
  {
    path: "/cart",
    name: "cart",
    component: () => import("../views/cartView.vue"),
    meta: { layout: "default" }
  },
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
    meta: { layout: "default" }
  },
  {
    path: "/register",
    name: "register",
    component: () => import("../views/RegisterView.vue"),
    meta: { layout: "default" }
  },
  {
    path: "/member-zone",
    name: "memberZone",
    component: () => import("../views/MemberZone.vue"),
    meta: { layout: "default" }
  },
  {
    path: "/orders/query",
    name: "orderQuery",
    component: () => import("../views/OrderQuery.vue"),
    meta: { layout: "default" }
  },
{
  path: "/admin/login",
  name: "adminLogin",
  component: () => import("../admin/views/AdminLogin.vue"),
  meta: { layout: "admin-login" }
},
  {
    path: "/admin",
    name:"admin",
    component: () => import("../admin/views/adminlayout.vue"),
    meta: { layout: "admin" },
    children: [
      // /admin → /admin/login
      {
        path: "",
        redirect: "/admin/login"
      },  
      { path: "dashboard", 
        name: "adminDashboard", 
        component: () => import("../admin/views/Dashboard.vue") },
      { path: "members", 
        name: "adminMembers", 
        component: () => import("../admin/views/Members.vue") },
      { path: "orders", 
        name: "adminOrders", 
        component: () => import("../admin/views/Orders.vue") },
      { path: "products", 
        name: "adminProducts", 
        component: () => import("../admin/views/AdminProducts.vue") },
      { path: "news", 
        name: "adminNews", 
        component: () => import("../admin/views/AdminNews.vue") },
      { path: "settings", 
        name: "adminSettings", 
        component: () => import("../admin/views/AdminSettings.vue") }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const token = localStorage.getItem("adminToken")

  if (to.path.startsWith("/admin") && to.path !== "/admin/login") {
    if (!token) return "/admin/login"
    try {
      const admin = JSON.parse(localStorage.getItem('adminUser') || '{}')
      if (admin.role === 'sales' && to.path !== '/admin/orders') return '/admin/orders'
    } catch {
      return '/admin/login'
    }
  }
})

export default router
