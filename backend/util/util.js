require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const port = process.env.PORT;
const User = require('../server/models/user_model');
const { TOKEN_SECRET } = process.env; // 30 days by seconds
const jwt = require('jsonwebtoken');
const { promisify } = require('util'); // util from native nodejs library
const AWS =require('aws-sdk')


/////////////////// Aws S3 setup //////////////////////
const S3 = new AWS.S3({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey:process.env.SECRET_ACCESS_KEY_ID
});

// 圖片上傳
const uploadAWS = multer({

    limit: {
        // 限制上傳檔案的大小為 2MB
        fileSize: 2000000
    },
    fileFilter(req, file, cb) {
        // 只接受三種圖片格式
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            cb(null, false);
        }
        cb(null, true);
    },
})

////////////////////////////////////////////////////////////




const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const productId = req.body.product_id;
            const imagePath = path.join(__dirname, `../public/assets/${productId}`);
            if (!fs.existsSync(imagePath)) {
                fs.mkdirSync(imagePath);
            }
            cb(null, imagePath);
        },
        filename: (req, file, cb) => {
            const customFileName = crypto.randomBytes(18).toString('hex').substr(0, 8);
            const fileExtension = file.mimetype.split('/')[1]; // get file extension from original file name
            cb(null, customFileName + '.' + fileExtension);
        }
    })
});

const uploadUserImage = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const userId = req.body.id;
            const imagePath = path.join(__dirname, `../public/assets/${userId}`);
            if (!fs.existsSync(imagePath)) {
                fs.mkdirSync(imagePath);
            }
            cb(null, imagePath);
        },
        filename: (req, file, cb) => {
            const customFileName = crypto.randomBytes(18).toString('hex').substr(0, 8);
            const fileExtension = file.mimetype.split('/')[1]; // get file extension from original file name
            cb(null, customFileName + '.' + fileExtension);
        }
    }),
    fileFilter(req, file, cb) {
        // 驗證是不是對的使用者
        if (req.body.id != req.user.id) {
            cb(null, false);
        } else {
            cb(null, true);
        }
    }
})

const getImagePath = (protocol, hostname, productId) => {
    if (protocol == 'http') {
        return protocol + '://' + hostname + ':' + port + '/assets/' + productId + '/';
    } else {
        return protocol + '://' + hostname + '/assets/' + productId + '/';
    }
};

const getUserImagePath = (protocol, hostname, userId) => {
    if (protocol == 'http') {
        return protocol + '://' + hostname + ':' + port + '/assets/' + userId + '/';
    } else {
        return protocol + '://' + hostname + '/assets/' + userId + '/';
    }
};

// reference: https://thecodebarbarian.com/80-20-guide-to-express-error-handling
const wrapAsync = (fn) => {
    return function (req, res, next) {
        // Make sure to `.catch()` any errors and pass them along to the `next()`
        // middleware in the chain, in this case the error handler.
        fn(req, res, next).catch(next);
    };
};

const authentication = (roleId) => {
    return async function (req, res, next) {
        let accessToken = req.get('Authorization');
        if (!accessToken) {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        accessToken = accessToken.replace('Bearer ', '');
        if (accessToken == 'null') {
            res.status(401).send({ error: 'Unauthorized' });
            return;
        }

        try {
            const user = await promisify(jwt.verify)(accessToken, TOKEN_SECRET);
            req.user = user;
            
            // check if the user id in the request body is the same as the user id in the token
            if (req.body && req.body.id) {
                if (req.body.id != user.id) {
                    res.status(403).send({ error: 'Forbidden' });
                    return;
                }
            }

            if (roleId == null) {
                next();
            } else {
                let userDetail;
                if (roleId == User.USER_ROLE.ALL) {
                    userDetail = await User.getUserDetail(user.id);
                } else {
                    userDetail = await User.getUserDetail(user.id, roleId);
                }
                if (!userDetail) {
                    res.status(403).send({ error: 'Forbidden' });
                } else {
                    req.user.id = userDetail.id;
                    req.user.role_id = userDetail.role_id;
                    next();
                }
            }
            return;
        } catch (err) {
            res.status(403).send({ error: 'Forbidden' });
            return;
        }
    };
};

module.exports = {
    upload,
    S3,
    uploadAWS,
    uploadUserImage,
    getImagePath,
    getUserImagePath,
    wrapAsync,
    authentication
};
