import { defineStore } from "pinia";

const optionsKey = (options) => {
  const labels = (Array.isArray(options) ? options : [])
    .map(o => o && o.label)
    .filter(Boolean)
    .sort()
    .join(',')
  return labels
}

const optionsPrice = (options) => {
  return (Array.isArray(options) ? options : []).reduce((sum, o) => sum + (Number(o.price) || 0), 0)
}

export { optionsPrice }

export const useCartStore=
    defineStore("cart",{
        state:()=>({
            cart:JSON.parse(localStorage.getItem("cart"))||[]
        }),
        getters:{
            totalqty(state){
                return state.cart.reduce((total,item)=>total+item.qty,0)
            },
            totalprice(state){
                return state.cart.reduce((total,item)=>total+item.qty * ((Number(item.price)||0) + optionsPrice(item.options)),0)
            },
            totalItems(state){
                return state.cart.length
            },
            isEmpty(state){
                return state.cart.length===0
            }
        },
        actions:{
            addToCart(prdt){
                const addQty=prdt.qty||1
                const key=`${prdt.id}|${optionsKey(prdt.options)}`
                const exitem= this.cart.find(item=>item.__key===key)

                if(exitem){
                    exitem.qty+=addQty
                }else{
                    this.cart.push({
                        ...prdt,
                        options: Array.isArray(prdt.options) ? prdt.options : [],
                        qty:addQty,
                        __key:key
                    })
                }

                this.savecart()
                //console.log(this.cart)
            },
            savecart(){
                localStorage.setItem("cart",JSON.stringify(this.cart))
            },
            changqty(key,v1){
                const item=this.cart.find(item=>item.__key===key)
                if(!item){
                    return 
                }
                item.qty +=v1
                if(item.qty<=0){
                    this.removeFromCart(key)    
                    return 
                }
                this.savecart()
            },
            removeFromCart(key){
                this.cart=this.cart.filter(item=>item.__key!==key)
                this.savecart()
            },
            clearcart(){
                this.cart=[]
                this.savecart()
            }
        }
    })
