// 5t7gjv6thdth6fff7yifi7yti7yi76ti767i6ffi76fi767yjf7yuyujycyukuyffuyyufjjufyjfuyfuyuyc

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: '5t7gjv6thdth6fff7yifi7yti7yi76ti767i6ffi76fi767yjf7yuyujycyukuyffuyyufjjufyjfuyfuyuyc' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;