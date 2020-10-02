const fs = require('fs');
const path = require("path");
const { categories, projects, about, home, global } = require('../../data/data.json');

async function isFirstRun() {
  const pluginStore = strapi.store({
    environment: strapi.config.environment,
    type: "type",
    name: "setup"
  });
  const initHasRun = await pluginStore.get({ key: "initHasRun" });
  await pluginStore.set({ key: "initHasRun", value: true });
  return !initHasRun;
};

async function setPublicPermissions(newPermissions) {
  // Find the ID of the public role
  const publicRole = await strapi
    .query("role", "users-permissions")
    .findOne({ type: "public" });

  // List all available permissions
  const publicPermissions = await strapi
    .query("permission", "users-permissions")
    .find({ type: "application", role: publicRole.id });

  // Update permission to match new config
  const controllersToUpdate = Object.keys(newPermissions);
  const updatePromises = publicPermissions
    .filter((permission) => {
      // Only update permissions included in newConfig
      if (!controllersToUpdate.includes(permission.controller)) {
        return false;
      }
      if (!newPermissions[permission.controller].includes(permission.action)) {
        return false;
      }
      return true;
    })
    .map((permission) => {
      // Enable the selected permissions
      return strapi
        .query("permission", "users-permissions")
        .update({ id: permission.id }, { enabled: true })
    });
  await Promise.all(updatePromises);
}

function getFilesizeInBytes(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats["size"];
  return fileSizeInBytes;
};

function getFileData(fileName) {
  const filePath = `./data/uploads/${fileName}`;

  // Parse the file metadata
  const size = getFilesizeInBytes(filePath);
  const ext = fileName.split(".").pop();
  const mimeType = `image/${ext === 'svg' ? 'svg+xml' : ext}`;

  return {
    path: filePath,
    name: fileName,
    size,
    type: mimeType,
  }
}

// Create an entry and attach files if there are any
async function createEntry(model, entry, files) {
  try {
    const createdEntry = await strapi.query(model).create(entry);
    if (files) {
      await strapi.entityService.uploadFiles(createdEntry, files, {
        model
      });
    }
  } catch (e) {
    console.log(e);
  }
}

async function importCategories() {
  return categories.map((category) => {
    return strapi.services.category.create(category);
  });
}

async function importProjects() {
  return projects.map(async (project) => {
    const coverImage = getFileData(`${project.slug}.jpg`);
    const files = {
      coverImage,
    };
    // Check if dynamic zone has attached files
    project.content.forEach((section, index) => {
      if (section.__component === 'sections.large-media') {
        files[`content.${index}.media`] = getFileData('large-media.jpg');
      } else if (section.__component === 'sections.images-slider') {
        // All project cover images
        const sliderFiles = projects.map((project) => {
          return getFileData(`${project.slug}.jpg`);
        });
        files[`content.${index}.images`] = sliderFiles;
      }
    });
    await createEntry('project', project, files);
  });
}

async function importGlobal() {
  // Add favicon image
  const favicon = getFileData('favicon.png');
  const files = {
    favicon,
  };
  // Add icon for each social network
  global.socialNetworks.forEach((network, index) => {
    files[`socialNetworks.${index}.icon`] = getFileData(
      `${network.title.toLowerCase()}.svg`
    );
  });
  await createEntry('global', global, files);
}

async function importHome() {
  const shareImage = getFileData('global.png');
  const files = {
    "seo.shareImage": shareImage,
  };
  await createEntry('home', home, files);
}

async function importAbout() {
  const aboutImage = getFileData('about.jpg');
  const files = {
    "seo.shareImage": aboutImage,
  };
  
  // Check for files to upload in the dynamic zone
  about.content.forEach((section, index) => {
    if (section.__component === 'sections.large-media') {
      files[`content.${index}.media`] = aboutImage;
    } else if (section.__component === 'sections.images-slider') {
      // All project cover images
      const sliderFiles = projects.map((project) => {
        return getFileData(`${project.slug}.jpg`);
      });
      files[`content.${index}.images`] = sliderFiles;
    }
  });
  
  // Save in Strapi
  await createEntry('about', about, files);
}

async function importSeedData() {
  // Allow read of application content types
  await setPublicPermissions({
    about: ['find'],
    category: ['find', 'findone'],
    global: ['find'],
    home: ['find'],
    project: ['find', 'findone'],
  });
  
  // Create all entries
  await importCategories();
  await importProjects();
  await importGlobal();
  await importHome();
  await importAbout();
};

module.exports = async () => {
  const shouldImportSeedData = await isFirstRun();
  if (shouldImportSeedData) {
    try {
      console.log('Setting up your starter...');
      await importSeedData();
      console.log('Ready to go');
    } catch (error) {
      console.log('Could not import seed data');
      console.error(error);
    }
  }
};
