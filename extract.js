const fs = require('fs');

function extract(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Find template boundary
    const templateMatch = content.match(/template:\s*`([\s\S]*?)`,\s*styles:/);
    if (!templateMatch) {
        console.log('Template not found in ' + filePath);
        return;
    }

    // Find styles boundary
    const stylesMatch = content.match(/styles:\s*\[\s*`([\s\S]*?)`\s*\]/);
    if (!stylesMatch) {
        console.log('Styles not found in ' + filePath);
        return;
    }

    const baseName = filePath.replace('.ts', '');
    fs.writeFileSync(`${baseName}.html`, templateMatch[1].trim());
    fs.writeFileSync(`${baseName}.scss`, stylesMatch[1].trim());

    // Replace decorator
    content = content.replace(
        /template:\s*`[\s\S]*?`,\s*styles:\s*\[\s*`[\s\S]*?`\s*\]/,
        `templateUrl: './${baseName.split('/').pop()}.html',\n  styleUrl: './${baseName.split('/').pop()}.scss'`
    );

    fs.writeFileSync(filePath, content);
    console.log(`Successfully extracted ${baseName}`);
}

extract('src/app/features/admin/components/orders/orders.component.ts');
extract('src/app/features/admin/components/dashboard/dashboard.component.ts');
