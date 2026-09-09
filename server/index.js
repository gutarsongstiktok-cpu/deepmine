const express=require('express');
const app=express(); app.use(express.json());
app.get('/api/health',(req,res)=>res.json({ok:true,game:'DeepMine'}));
app.post('/api/sync',(req,res)=>res.json({ok:true, savedAt:Date.now(), state:req.body}));
app.listen(process.env.PORT||3000,()=>console.log('DeepMine API running'));
