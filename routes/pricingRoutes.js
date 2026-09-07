const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * @route POST /api/pricing/create
 * @desc Create a new pricing plan
 */
router.post('/create', async (req, res) => {
    try {
        const { category, plan_name, price, features, is_featured, serviceIds } = req.body;

        if (!category || !plan_name || !price) {
            return res.status(400).json({ status: 400, error: 'Category, plan name, and price are required.' });
        }

        // Ensure features is stored as a string if sent as an array
        const featuresData = Array.isArray(features) ? JSON.stringify(features) : features;

        const [result] = await db.query(
            `INSERT INTO admin_pricing (category, plan_name, price, features, is_featured) VALUES (?, ?, ?, ?, ?)`,
            [category, plan_name, price, featuresData, is_featured ? 1 : 0]
        );
        const planId = result.insertId;

        // Insert into junction table if serviceIds provided
        if (Array.isArray(serviceIds) && serviceIds.length > 0) {
            const values = serviceIds.map(sid => [sid, planId]);
            await db.query(`INSERT INTO admin_service_pricing (service_id, pricing_id) VALUES ?`, [values]);
        }

        res.status(201).json({
            status: 201,
            message: 'Pricing plan created successfully',
            planId: planId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 500, error: 'Failed to create pricing plan.' });
    }
});

/**
 * @route GET /api/pricing
 * @desc Get all pricing plans
 */
router.get('/', async (req, res) => {
    try {
        const [plans] = await db.query(`
            SELECT p.*, GROUP_CONCAT(sp.service_id) as serviceIds
            FROM admin_pricing p
            LEFT JOIN admin_service_pricing sp ON p.id = sp.pricing_id
            GROUP BY p.id
            ORDER BY p.price ASC
        `);
        
        // Parse JSON features back to arrays for the frontend
        const formattedPlans = plans.map(plan => ({
            ...plan,
            features: JSON.parse(plan.features || "[]"),
            serviceIds: plan.serviceIds ? plan.serviceIds.split(',').map(Number) : []
        }));

        res.status(200).json({
            status: 200,
            data: formattedPlans
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 500, error: 'Failed to fetch pricing.' });
    }
});

/**
 * @route PUT /api/pricing/update/:id
 * @desc Update a pricing plan
 */
router.put('/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { category, plan_name, price, features, is_featured, serviceIds } = req.body;

        const featuresData = Array.isArray(features) ? JSON.stringify(features) : features;

        const [result] = await db.query(
            `UPDATE admin_pricing SET category = ?, plan_name = ?, price = ?, features = ?, is_featured = ? WHERE id = ?`,
            [category, plan_name, price, featuresData, is_featured ? 1 : 0, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 404, error: 'Plan not found.' });
        }

        if (Array.isArray(serviceIds)) {
            // Delete existing mappings
            await db.query('DELETE FROM admin_service_pricing WHERE pricing_id = ?', [id]);
            // Insert new mappings
            if (serviceIds.length > 0) {
                const values = serviceIds.map(sid => [sid, id]);
                await db.query(`INSERT INTO admin_service_pricing (service_id, pricing_id) VALUES ?`, [values]);
            }
        }

        res.status(200).json({ status: 200, message: 'Pricing plan updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 500, error: 'Failed to update plan.' });
    }
});

/**
 * @route DELETE /api/pricing/delete/:id
 * @desc Delete a pricing plan
 */
router.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM admin_service_pricing WHERE pricing_id = ?', [id]);
        const [result] = await db.query('DELETE FROM admin_pricing WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 404, error: 'Plan not found.' });
        }

        res.status(200).json({ status: 200, message: 'Plan deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 500, error: 'Failed to delete plan.' });
    }
});

/**
 * @route GET /api/pricing/service/:serviceId
 * @desc Get all pricing plans linked to a specific service
 */
router.get('/service/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const [plans] = await db.query(`
            SELECT p.* 
            FROM admin_pricing p
            JOIN admin_service_pricing sp ON p.id = sp.pricing_id
            WHERE sp.service_id = ?
            ORDER BY p.price ASC
        `, [serviceId]);
        
        const formattedPlans = plans.map(plan => ({
            ...plan,
            features: JSON.parse(plan.features || "[]")
        }));
        res.status(200).json({ status: 200, data: formattedPlans });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 500, error: 'Failed to fetch pricing for service.' });
    }
});

/**
 * @route POST /api/pricing/link
 * @desc Link an existing pricing plan to a service
 */
router.post('/link', async (req, res) => {
    try {
        const { serviceId, pricingId } = req.body;
        // Check if already linked to avoid errors (or use IGNORE, but manual check is safer)
        const [existing] = await db.query('SELECT * FROM admin_service_pricing WHERE service_id = ? AND pricing_id = ?', [serviceId, pricingId]);
        if (existing.length === 0) {
            await db.query('INSERT INTO admin_service_pricing (service_id, pricing_id) VALUES (?, ?)', [serviceId, pricingId]);
        }
        res.status(200).json({ status: 200, message: 'Plan linked successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 500, error: 'Failed to link plan.' });
    }
});

/**
 * @route POST /api/pricing/unlink
 * @desc Unlink a pricing plan from a service
 */
router.post('/unlink', async (req, res) => {
    try {
        const { serviceId, pricingId } = req.body;
        await db.query('DELETE FROM admin_service_pricing WHERE service_id = ? AND pricing_id = ?', [serviceId, pricingId]);
        res.status(200).json({ status: 200, message: 'Plan unlinked successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 500, error: 'Failed to unlink plan.' });
    }
});

module.exports = router;
