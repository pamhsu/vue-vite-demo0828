<script>

import prdtcard from "../components/prdt.vue" 
import {usePrdtStore} from "../store/products.js"
import {useCartStore} from "../store/cart.js"

export default{
  data(){
    return{
      prdtstore:usePrdtStore(),
      cartstore:useCartStore(),
      showDetail:false,
      detailProduct:null,
      detailQty:1,
      detailOptions:{}
    }
  },
  computed: {
    categories(){
      return this.prdtstore.categories
    },
    filteredProducts(){
      if(this.prdtstore.selectedCategory==="全部"){
        return this.prdtstore.prdt
      }
      return this.prdtstore.getPrdtByCategory(this.prdtstore.selectedCategory)
    },
    detailOptionList(){
      if(!this.detailProduct)return []
      let opts=this.detailProduct.options
      if(!opts)return []
      if(!Array.isArray(opts)){ try{opts=JSON.parse(opts)}catch(e){return []} }
      return Array.isArray(opts)?opts:[]
    },
    detailOptionsPrice(){
      return this.detailOptionList.reduce((sum,o)=>{
        return sum + (this.detailOptions[o.label] ? (Number(o.price)||0) : 0)
      },0)
    },
    detailUnitPrice(){
      if(!this.detailProduct)return 0
      return (Number(this.detailProduct.price)||0)+this.detailOptionsPrice
    }
  },
  methods: {
      addToCart(prdt){
        this.cartstore.addToCart(prdt)
      },
      openDetail(prdt){
        this.detailProduct=prdt
        this.detailQty=1
        this.detailOptions={}
        this.showDetail=true
      },
      closeDetail(){
        this.showDetail=false
        this.detailProduct=null
        this.detailOptions={}
      },
      toggleOption(label){
        if(this.detailOptions[label]){ delete this.detailOptions[label] }else{ this.detailOptions[label]=true }
      },
      changeDetailQty(delta){
        this.detailQty=Math.max(1,this.detailQty+delta)
      },
      addDetailToCart(){
        if(!this.detailProduct)return
        const selected=this.detailOptionList.filter(o=>this.detailOptions[o.label]).map(o=>({label:o.label,price:Number(o.price)||0}))
        this.cartstore.addToCart({...this.detailProduct,qty:this.detailQty,options:selected})
        this.closeDetail()
      }
  },
  mounted() {
    this.prdtstore.fetchProduct()
  },
  components:{
    prdtcard
  }
 }
</script>

<template>
    <main class="page">
      <!-- <section class="hero">
        <h1>菜單</h1>
        <p>
          選擇您喜愛的披薩口味，立即加入購物車
        </p>
      </section> -->

      <div v-if="!prdtstore.isLoading && !prdtstore.errmsg" class="category-bar">
        <button
          type="button"
          class="category-btn"
          :class="{ active: prdtstore.selectedCategory === '全部' }"
          @click="prdtstore.selectedCategory = '全部'"
        >
          全部
        </button>
        <button
          v-for="cat in categories"
          :key="cat"
          type="button"
          class="category-btn"
          :class="{ active: prdtstore.selectedCategory === cat }"
          @click="prdtstore.selectedCategory = cat"
        >
          {{ cat }}
        </button>
      </div>

      <section v-if="prdtstore.isLoading">
        <p>菜單載入中...</p>
      </section>

      <section v-else-if="prdtstore.errmsg">
        <p>{{ prdtstore.errmsg }}</p>
      </section>
      
      <section v-else class="products">
        <prdtcard v-for="item in filteredProducts" :key="item.id" :prdt="item" @add="addToCart" @open-detail="openDetail"></prdtcard>
      </section>

      <Teleport to="body">
        <div v-if="showDetail" class="modal-overlay" @click.self="closeDetail">
          <div class="modal-content">
            <button type="button" class="modal-close" @click="closeDetail">&times;</button>
            <img v-if="detailProduct.image" :src="detailProduct.image" :alt="detailProduct.name" class="modal-img" />
            <span class="modal-category">{{ detailProduct.category }}</span>
            <h2 class="modal-title">{{ detailProduct.name }}</h2>
            <p class="modal-desc">{{ detailProduct.desc }}</p>
            <p class="modal-price">NT$ {{ detailUnitPrice.toLocaleString() }}</p>

            <div v-if="detailOptionList.length" class="option-section">
              <p class="option-title">配料 / 特殊需求</p>
              <label v-for="opt in detailOptionList" :key="opt.label" class="option-item">
                <input type="checkbox" :checked="!!detailOptions[opt.label]" @change="toggleOption(opt.label)" />
                <span>{{ opt.label }}</span>
                <span v-if="opt.price > 0" class="option-price">+NT${{ opt.price }}</span>
                <span v-else class="option-price">+NT$0</span>
              </label>
            </div>

            <div class="qty-row">
              <button type="button" class="qty-btn" @click="changeDetailQty(-1)">-</button>
              <span class="qty-num">{{ detailQty }}</span>
              <button type="button" class="qty-btn" @click="changeDetailQty(1)">+</button>
            </div>
            <button type="button" class="btn w-100" @click="addDetailToCart">加入購物車</button>
          </div>
        </div>
      </Teleport>

    </main>
</template>

<style scoped>
.category-bar{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  justify-content:center;
  padding:16px 0;
}

.category-btn{
  padding:6px 16px;
  border:1px solid #73612C;
  background:#fff;
  color:#73612C;
  border-radius:20px;
  cursor:pointer;
  transition:background 0.2s, color 0.2s;
}

.category-btn:hover,
.category-btn.active{
  background:#73612C;
  color:#fff;
}

.modal-overlay{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.5);
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:1000;
  padding:16px;
}

.modal-content{
  background:#fff;
  border-radius:12px;
  padding:24px;
  max-width:420px;
  width:100%;
  position:relative;
  max-height:90vh;
  overflow-y:auto;
}

.modal-close{
  position:absolute;
  top:8px;
  right:12px;
  background:none;
  border:none;
  font-size:28px;
  cursor:pointer;
  color:#666;
}

.modal-img{
  width:100%;
  aspect-ratio: 3 / 2;
  object-fit:cover;
  border-radius:8px;
  margin-bottom:12px;
}

.modal-category{
  display:inline-block;
  background:#73612C;
  color:#fff;
  padding:2px 10px;
  border-radius:12px;
  font-size:13px;
  margin-bottom:8px;
}

.modal-title{
  margin:8px 0;
}

.modal-desc{
  color:#555;
  margin-bottom:12px;
}

.modal-price{
  font-size:20px;
  font-weight:bold;
  color:#73612C;
  margin-bottom:16px;
}

.qty-row{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:12px;
  margin:8px 0 16px;
}

.qty-btn{
  width:36px;
  height:36px;
  border:1px solid #73612C;
  background:#fff;
  color:#73612C;
  /* border-radius:50%; */
  font-size:20px;
  font-weight:bold;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  transition:background 0.2s, color 0.2s;
}

.qty-btn:hover{
  background:#73612C;
  color:#fff;
}

.qty-num{
  min-width:28px;
  text-align:center;
  font-size:18px;
  font-weight:bold;
}

.option-section{
  border-top:1px solid #e8e3d9;
  margin:8px 0 4px;
  padding-top:12px;
}

.option-title{
  font-weight:700;
  color:#73612C;
  margin:0 0 8px;
  font-size:14px;
}

.option-item{
  display:flex;
  align-items:center;
  gap:8px;
  padding:6px 0;
  cursor:pointer;
  font-size:14px;
  color:#333;
}

.option-item input{
  width:16px;
  height:16px;
  accent-color:#73612C;
}

.option-price{
  margin-left:auto;
  color:#73612C;
  font-weight:600;
}
</style>
