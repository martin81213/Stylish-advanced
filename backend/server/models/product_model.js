const { pool } = require('./mysqlcon');

const createProduct = async (product, variants, images) => {
    const conn = await pool.getConnection();
    try {
        await conn.query('START TRANSACTION');
        const [result] = await conn.query('INSERT INTO product SET ?', product);
        await conn.query('INSERT INTO variant(product_id, color_id, size, stock) VALUES ?', [variants]);
        await conn.query('INSERT INTO product_images(product_id, image) VALUES ?', [images]);
        await conn.query('COMMIT');
        return result.insertId;
    } catch (error) {
        await conn.query('ROLLBACK');
        console.log(error)
        return -1;
    } finally {
        await conn.release();
    }
};

// Comment 對資料庫的操作
const createComment = async (productId, userId, text, rating, image_url) => {
    const conn = await pool.getConnection();
    //console.log('DBDBDBDB',userId,productId,text,rating)
    console.log("Comment 對 DB 操作開始")
    console.log(productId)
    console.log(userId)
    console.log(text)
    console.log(rating)
    console.log(image_url)

    try {
        // Insert a new comment into the comment table
        const [result] = await conn.query(
            'INSERT INTO comment (productId, userId, text, rating, images_url) VALUES (?, ?, ?, ?, ?)',
            [productId, userId, text, rating, image_url]
        );
        // console.log(result.insertId);


        return result.insertId; // Return the ID of the newly inserted comment
    } catch (error) {
        console.error('Error creating comment:', error);
        return -1; // Return -1 or some other error indicator based on your logic
    } finally {
        await conn.release();
    }
};

// getComment 的 DB操作
const getComment = async (productId) => {
    const conn = await pool.getConnection();
    try{
        const [result] = await conn.query(
            `SELECT * FROM comment WHERE productId = ${productId}`
        )
        console.log(result);
        return result;
    }catch (error) {
        console.error('Error Getting comment:', error);
        return -1; // Return -1 or some other error indicator based on your logic
    }
}


// Like Comment的DB操作
const likeComment = async (commentId) => {
    const conn = await pool.getConnection();
    console.log('評論的ID是: ', commentId)
    try {
        // 更新评论的点赞数量
        const [result] = await conn.query(
            'UPDATE comment SET likes = likes + 1 WHERE commentId = ?',
            [commentId]
        );

        return result.affectedRows > 0;
    } catch (error) {
        console.error('点赞时出错：', error);
        return false;
    } finally {
        await conn.release();
    }
};


const getProducts = async (pageSize, paging = 0, requirement = {}) => {
    const condition = { sql: '', binding: [] };
    if (requirement.category) {
        condition.sql = 'WHERE category = ?';
        condition.binding = [requirement.category];
    } else if (requirement.keyword != null) {
        condition.sql = 'WHERE title LIKE ?';
        condition.binding = [`%${requirement.keyword}%`];
    } else if (requirement.id != null) {
        condition.sql = 'WHERE id = ?';
        condition.binding = [requirement.id];
    }

    const limit = {
        sql: 'LIMIT ?, ?',
        binding: [pageSize * paging, pageSize]
    };

    const productQuery = 'SELECT * FROM product ' + condition.sql + ' ORDER BY id ' + limit.sql;
    const productBindings = condition.binding.concat(limit.binding);
    const [products] = await pool.query(productQuery, productBindings);

    const productCountQuery = 'SELECT COUNT(*) as count FROM product ' + condition.sql;
    const productCountBindings = condition.binding;

    const [productCounts] = await pool.query(productCountQuery, productCountBindings);

    return {
        'products': products,
        'productCount': productCounts[0].count
    };
};

const getHotProducts = async (hotId) => {
    const productQuery = 'SELECT product.* FROM product INNER JOIN hot_product ON product.id = hot_product.product_id WHERE hot_product.hot_id = ? ORDER BY product.id';
    const productBindings = [hotId];
    const [hots] = await pool.query(productQuery, productBindings);
    return hots;
};

const getProductsVariants = async (productIds) => {
    const queryStr = 'SELECT * FROM variant INNER JOIN color ON variant.color_id = color.id WHERE product_id IN (?)';
    const bindings = [productIds];
    const [variants] = await pool.query(queryStr, bindings);
    return variants;
};

const getProductsImages = async (productIds) => {
    const queryStr = 'SELECT * FROM product_images WHERE product_id IN (?)';
    const bindings = [productIds];
    const [variants] = await pool.query(queryStr, bindings);
    return variants;
};



module.exports = {
    createComment,
    getComment,
    likeComment,
    createProduct,
    getProducts,
    getHotProducts,
    getProductsVariants,
    getProductsImages,
};