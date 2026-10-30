<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">DAFTAR GALERI FOTO</h3>
                            <div class="card-tools">
                                <a href="<?= site_url('Administrator/tambah_galeri') ?>" class="btn btn-tool">
                                    <i class="fas fa-chalkboard-teacher"></i>
                                </a>

                            </div>
                        </div>
                        <div class="card-body">
                            <table class="table table-stripped" id="example2">
                                <thead>
                                    <tr>
                                        <th>No.</th>
                                        <th>Gambar</th>
                                        <th>Judul</th>
                                        <th>Tanggal Upload</th>
                                        <th>View</th>
                                        <th width="70px" class="text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php $urut = 1;
                                    foreach ($galeri as $b) { ?>
                                        <tr>
                                            <td><?= $urut; ?></td>
                                            <td>
                                                <img width="100px" src="<?= base_url() ?>assets/img/foto/<?= $b->foto; ?>">
                                            </td>
                                            <td><?= $b->judul; ?></td>
                                            <td><?= date('d M Y', strtotime($b->tgl_upload)); ?></td>
                                            <td><?= $b->view; ?> <i class="fas fa-users"></i></td>
                                            <td>
                                                <a class="btn btn-success btn-sm" href="<?= site_url('Administrator/edit_galeri/' . $b->id_galeri) ?>"><i class="fas fa-edit"></i></a>
                                                <a class="btn btn-danger btn-sm" href="<?= site_url('Administrator/hapus_galeri/' . $b->id_galeri) ?>"><i class="fas fa-trash"></i></a>
                                            </td>
                                        </tr>
                                    <?php $urut++;
                                    }    ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>