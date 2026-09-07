<script>
    export default{
        props:{
            prdt:{
                type:Object,
                required:true
            }
        },
        emits:["add","open-detail"],
        data(){
            return{
                qty:1
            }
        },
        methods: {
            openDetail(){
                this.$emit("open-detail",this.prdt)
            },
            goCategory(){
                this.$router.push(`/products/category/${this.prdt.category}`)
            },
            changeQty(delta){
                this.qty=Math.max(1,this.qty+delta)
            },
            handleAdd(){
                this.$emit("add",{...this.prdt,qty:this.qty})
                this.qty=1
            }
        },
    }
</script>

<template>
    <article @click="openDetail">
        <span @click.stop="goCategory" class="category">
            {{ prdt.category }}
        </span>
        <img v-if="prdt.image" :src="prdt.image" :alt="prdt.name" class="prdt-img" />
        <h3>
            {{ prdt.name }}
        </h3>
        <p>
            {{ prdt.desc }}
        </p>
        <strong>
            NT$ {{prdt.price.toLocaleString()}}
        </strong>
        <div class="qty-row" @click.stop>
            <button type="button" class="qty-btn" @click="changeQty(-1)">-</button>
            <div class="qty-num">{{ qty }}</div>
            <button type="button" class="qty-btn" @click="changeQty(1)">+</button>
        </div>
        <button type="button" class="btn w-100" @click.stop="handleAdd">
            加入購物車
        </button>
    </article>
</template>

<style scoped>
    .category{
        display: inline;
        cursor: pointer;
        transition: color 0.2s, background-color 0.2s;
    }

    .category:hover{
        color: white;
        background-color: #73612C;
        transform: translateY(-5px);
    }

    .prdt-img{
        width: 100%;
        aspect-ratio: 3 / 2;
        object-fit: cover;
        border-radius: 8px;
        margin: 8px 0;
    }

    .qty-row{
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 8px 0;
    }

    .qty-btn{
        width: 32px;
        height: 32px;
        border: 1px solid #73612C;
        background: #fff;
        color: #73612C;
        /* border-radius: 50%; */
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s, color 0.2s;
    }

    .qty-btn:hover{
        background: #73612C;
        color: #fff;
    }

    .qty-num{
        min-width: 24px;
        text-align: center;
        font-size: 16px;
        font-weight: bold;
    }
</style>
