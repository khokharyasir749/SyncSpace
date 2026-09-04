const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Channel = require('../models/Channel');
const Message = require('../models/Message');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/syncspace';

async function seedDatabase() {
  console.log('====================================================');
  console.log('        SyncSpace Database Seeding Utility          ');
  console.log('====================================================\n');

  try {
    console.log(`[1/5] Connecting to MongoDB: ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI);
    console.log('✔ Connected to MongoDB successfully.\n');

    console.log('[2/5] Purging existing collection documents...');
    await Promise.all([
      User.deleteMany({}),
      Workspace.deleteMany({}),
      Channel.deleteMany({}),
      Message.deleteMany({}),
    ]);
    console.log('✔ Collections cleared.\n');

    console.log('[3/5] Creating demo user accounts...');
    const alice = await User.create({
      name: 'Alice Architect',
      email: 'alice@syncspace.io',
      password: 'password123',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=6366f1',
      isOnline: false,
    });

    const bob = await User.create({
      name: 'Bob Builder',
      email: 'bob@syncspace.io',
      password: 'password123',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Milo&backgroundColor=10b981',
      isOnline: false,
    });

    console.log(`  * User created: ${alice.name} (${alice.email})`);
    console.log(`  * User created: ${bob.name} (${bob.email})`);
    console.log('  * Password for both: password123\n');

    console.log('[4/5] Creating demo workspace: "Acme Corp"...');
    const workspace = await Workspace.create({
      name: 'Acme Corp',
      slug: 'acme-corp',
      owner: alice._id,
      members: [
        { user: alice._id, role: 'admin', joinedAt: new Date() },
        { user: bob._id, role: 'member', joinedAt: new Date() },
      ],
    });
    console.log(`✔ Workspace created: ${workspace.name} (Slug: /${workspace.slug})\n`);

    console.log('[5/5] Creating channels & sample conversations...');
    const generalChannel = await Channel.create({
      workspaceId: workspace._id,
      name: 'general',
      type: 'public',
      members: [alice._id, bob._id],
    });

    const devChannel = await Channel.create({
      workspaceId: workspace._id,
      name: 'development',
      type: 'public',
      members: [alice._id, bob._id],
    });

    // Seed welcoming messages
    await Message.create({
      channelId: generalChannel._id,
      sender: alice._id,
      content: 'Welcome to Acme Corp on SyncSpace! 🚀 Feel free to test real-time chat, typing indicators, and presence.',
      readBy: [alice._id, bob._id],
    });

    await Message.create({
      channelId: generalChannel._id,
      sender: bob._id,
      content: 'Glad to be here! The interface looks sleek and lightning fast.',
      readBy: [alice._id, bob._id],
    });

    await Message.create({
      channelId: devChannel._id,
      sender: alice._id,
      content: 'This channel is for engineering discussions, architecture updates, and PR links.',
      readBy: [alice._id],
    });

    console.log(`✔ Channels created: #${generalChannel.name}, #${devChannel.name}`);
    console.log('✔ Welcome messages seeded.\n');

    console.log('====================================================');
    console.log('   DATABASE SEEDING FINISHED WITH 100% SUCCESS!    ');
    console.log('====================================================');
    console.log('\nDemo Logins:');
    console.log('  1) Email: alice@syncspace.io | Password: password123');
    console.log('  2) Email: bob@syncspace.io   | Password: password123\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n✖ Seeding failed with error:', error);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

seedDatabase();
