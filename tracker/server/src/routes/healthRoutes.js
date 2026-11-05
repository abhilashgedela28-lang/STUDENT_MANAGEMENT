const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

router.get('/', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    res.json({
      status: 'UP',
      components: {
        db: {
          status: 'UP',
          details: {
            database: 'MongoDB',
          },
        },
      },
    });
  } else {
    res.status(503).json({
      status: 'DOWN',
      components: {
        db: {
          status: 'DOWN',
        },
      },
    });
  }
});

module.exports = router;
