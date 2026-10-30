// Stripe line items are built only from the committed server-side order snapshot.
export function checkoutLineItems(order, items) {
  let remaining=order.discount_cents;
  const lines=items.map((item,index)=>{
    const gross=item.unit_price_cents*item.quantity;
    const discount=index===items.length-1?remaining:Math.min(remaining,Math.floor(order.discount_cents*gross/order.subtotal_cents));
    remaining-=discount;
    return {quantity:1,price_data:{currency:'eur',unit_amount:gross-discount,product_data:{name:`${item.product_name} · ${item.color} × ${item.quantity}`.slice(0,250)}}};
  });
  if(order.shipping_cents>0)lines.push({quantity:1,price_data:{currency:'eur',unit_amount:order.shipping_cents,product_data:{name:'Доставка'}}});
  if(lines.reduce((s,l)=>s+l.price_data.unit_amount,0)!==order.total_cents)throw new Error('ORDER_TOTAL_MISMATCH');
  return lines;
}
export const isReceiptSession=id=>typeof id==='string'&&/^cs_(test_|live_)?[A-Za-z0-9]{20,200}$/.test(id);
export function receiptState(order){return {order_number:order.order_number,payment_status:order.payment_status,total_cents:order.total_cents,shipping_cents:order.shipping_cents};}
